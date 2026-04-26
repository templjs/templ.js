export interface DiagnosticsScheduleOptions {
  immediate?: boolean;
  force?: boolean;
}

export interface DeterministicDiagnosticsOrchestratorOptions<TDiagnostic> {
  debounceMs?: number;
  getDocumentText: (uri: string) => string | undefined;
  resolveRevisionKey: (uri: string, text: string) => string;
  collectLocalDiagnostics: (uri: string, text: string) => Promise<TDiagnostic[]> | TDiagnostic[];
  collectExtendedDiagnostics: (uri: string, text: string) => Promise<TDiagnostic[]> | TDiagnostic[];
  publishDiagnostics: (uri: string, diagnostics: TDiagnostic[]) => void;
  log?: (message: string) => void;
}

interface DocumentDiagnosticsState<TDiagnostic> {
  revisionKey?: string;
  localDiagnostics: TDiagnostic[];
  extendedDiagnostics: TDiagnostic[];
  timer: ReturnType<typeof setTimeout> | undefined;
}

function defaultLog(_message: string): void {
  // Intentionally empty.
}

export class DeterministicDiagnosticsOrchestrator<TDiagnostic> {
  private readonly debounceMs: number;
  private readonly getDocumentText: (uri: string) => string | undefined;
  private readonly resolveRevisionKey: (uri: string, text: string) => string;
  private readonly collectLocalDiagnostics: (
    uri: string,
    text: string
  ) => Promise<TDiagnostic[]> | TDiagnostic[];
  private readonly collectExtendedDiagnostics: (
    uri: string,
    text: string
  ) => Promise<TDiagnostic[]> | TDiagnostic[];
  private readonly publishDiagnostics: (uri: string, diagnostics: TDiagnostic[]) => void;
  private readonly log: (message: string) => void;
  private readonly stateByUri = new Map<string, DocumentDiagnosticsState<TDiagnostic>>();

  constructor(options: DeterministicDiagnosticsOrchestratorOptions<TDiagnostic>) {
    this.debounceMs = Math.max(0, options.debounceMs ?? 0);
    this.getDocumentText = options.getDocumentText;
    this.resolveRevisionKey = options.resolveRevisionKey;
    this.collectLocalDiagnostics = options.collectLocalDiagnostics;
    this.collectExtendedDiagnostics = options.collectExtendedDiagnostics;
    this.publishDiagnostics = options.publishDiagnostics;
    this.log = options.log ?? defaultLog;
  }

  schedule(uri: string, options?: DiagnosticsScheduleOptions): void {
    const state = this.getOrCreateState(uri);
    const immediate = options?.immediate ?? false;

    this.log(
      `[templjs-orch] schedule uri=${uri} immediate=${immediate} debounceMs=${this.debounceMs} hasPendingTimer=${!!state.timer}`
    );

    if (immediate || this.debounceMs === 0) {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = undefined;
      }
      this.run(uri);
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
    }

    state.timer = setTimeout(() => {
      state.timer = undefined;
      this.run(uri);
    }, this.debounceMs);
  }

  clear(uri: string): void {
    const state = this.stateByUri.get(uri);
    if (!state) {
      return;
    }
    if (state.timer) {
      clearTimeout(state.timer);
    }
    this.stateByUri.delete(uri);
  }

  private run(uri: string): void {
    const text = this.getDocumentText(uri);
    if (text === undefined) {
      return;
    }

    const revisionKey = this.resolveRevisionKey(uri, text);
    const state = this.getOrCreateState(uri);

    const prevKey = state.revisionKey;
    const keyChanged = revisionKey !== prevKey;
    this.log(
      `[templjs-orch] run uri=${uri} revisionKey=${revisionKey} prevKey=${prevKey ?? 'none'} keyChanged=${keyChanged}`
    );

    if (keyChanged) {
      state.localDiagnostics = [];
      state.extendedDiagnostics = [];
    }
    state.revisionKey = revisionKey;

    const commit = (
      source: 'local' | 'extended' | 'merged',
      localDiagnostics: TDiagnostic[],
      extendedDiagnostics: TDiagnostic[]
    ): void => {
      const current = this.stateByUri.get(uri);
      if (!current) {
        this.log(
          `[templjs-orch] commit DROPPED source=${source} reason=state-cleared revisionKey=${revisionKey}`
        );
        return;
      }
      if (current.revisionKey !== revisionKey) {
        this.log(
          `[templjs-orch] commit DROPPED source=${source} reason=stale revisionKey=${revisionKey} currentKey=${current.revisionKey ?? 'none'}`
        );
        return;
      }

      current.localDiagnostics = localDiagnostics;
      current.extendedDiagnostics = extendedDiagnostics;

      this.log(
        `[templjs-orch] commit APPLIED source=${source} count=${localDiagnostics.length + extendedDiagnostics.length} revisionKey=${revisionKey} publishing total=${current.localDiagnostics.length + current.extendedDiagnostics.length}`
      );
      this.publishDiagnostics(uri, [...current.localDiagnostics, ...current.extendedDiagnostics]);
    };

    let localDone = false;
    let extendedDone = false;
    let localDiagnostics: TDiagnostic[] = [];
    let extendedDiagnostics: TDiagnostic[] = [];

    Promise.resolve()
      .then(() => this.collectLocalDiagnostics(uri, text))
      .then((diagnostics) => {
        localDone = true;
        localDiagnostics = diagnostics;
        commit('local', localDiagnostics, []);
        if (extendedDone) {
          commit('merged', localDiagnostics, extendedDiagnostics);
        }
      })
      .catch((error: unknown) => {
        this.log(
          `[templjs] Local diagnostics failed for ${uri}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });

    Promise.resolve()
      .then(() => this.collectExtendedDiagnostics(uri, text))
      .then((diagnostics) => {
        extendedDone = true;
        extendedDiagnostics = diagnostics;
        if (localDone) {
          commit('merged', localDiagnostics, extendedDiagnostics);
        }
      })
      .catch((error: unknown) => {
        this.log(
          `[templjs] Extended diagnostics failed for ${uri}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
  }

  private getOrCreateState(uri: string): DocumentDiagnosticsState<TDiagnostic> {
    const existing = this.stateByUri.get(uri);
    if (existing) {
      return existing;
    }

    const created: DocumentDiagnosticsState<TDiagnostic> = {
      revisionKey: undefined,
      localDiagnostics: [],
      extendedDiagnostics: [],
      timer: undefined,
    };

    this.stateByUri.set(uri, created);
    return created;
  }
}

export function createDeterministicDiagnosticsOrchestrator<TDiagnostic>(
  options: DeterministicDiagnosticsOrchestratorOptions<TDiagnostic>
): DeterministicDiagnosticsOrchestrator<TDiagnostic> {
  return new DeterministicDiagnosticsOrchestrator(options);
}
