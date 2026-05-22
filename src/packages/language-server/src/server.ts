import { pathToFileURL } from 'url';
import { URI } from 'vscode-uri';
import { createConnection, createServer, createSimpleProject } from '@volar/language-server/node';
import { createTempljsLanguagePlugins } from '@templjs/language-core';
import type { Diagnostic } from '@volar/language-service';
import {
  createTempljsServicePlugins,
  resolveWorkspaceRoot,
  type InitializeParamsLike,
  type ServerInitializationOptions,
} from '@templjs/language-service';
import {
  deriveWorkspaceRootFromDocumentUri,
  isLikelySchemaUri,
  isYamlTemplateUri,
} from './server-uri.js';

// Write to stderr for debugging server startup
console.error('[templjs-server] Starting instantiation...');

const connection = createConnection();
const server = createServer(connection);
console.error('[templjs-server] Connection and server created');

type CrashGuardState = {
  installed: boolean;
  report: (message: string) => void;
};

const crashGuardStateKey = Symbol.for('templjs.language-server.crash-guards');
const globalWithCrashGuards = globalThis as typeof globalThis & {
  [crashGuardStateKey]?: CrashGuardState;
};
/* c8 ignore start */
const crashGuardState: CrashGuardState =
  globalWithCrashGuards[crashGuardStateKey] ??
  (globalWithCrashGuards[crashGuardStateKey] = {
    installed: false,
    report: (message: string) => {
      console.error(message);
    },
  });

function formatCrashReason(reason: unknown): string {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}\n${reason.stack ?? ''}`.trim();
  }

  return String(reason);
}

function terminateProcessAfterCrash(): void {
  // Keep unit tests alive while still exposing a non-zero termination signal.
  if (process.env.NODE_ENV === 'test') {
    process.exitCode = 1;
    return;
  }

  process.exitCode = 1;
  process.exit(1);
}

function installCrashGuards(): void {
  crashGuardState.report = (message: string) => {
    console.error(message);
    connection.console.error(message);
  };

  if (crashGuardState.installed) {
    return;
  }
  crashGuardState.installed = true;

  process.on('uncaughtException', (error) => {
    const message = formatCrashReason(error);
    crashGuardState.report(`[templjs-server] uncaughtException ${message}`);
    terminateProcessAfterCrash();
  });

  process.on('unhandledRejection', (reason) => {
    const message = formatCrashReason(reason);
    crashGuardState.report(`[templjs-server] unhandledRejection ${message}`);
    terminateProcessAfterCrash();
  });
}
/* c8 ignore stop */

installCrashGuards();

let storedWorkspaceRoot: string | undefined;
let storedInitializationOptions: ServerInitializationOptions | undefined;
const schemaSourceCache = new Map<string, unknown>();

type TraceMode = 'off' | 'messages' | 'verbose';

let serverTraceMode: TraceMode = 'off';

const TEMPLJS_COMPLETION_TRIGGER_CHARACTERS = [
  '.',
  '|',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
] as const;

type SemanticTokensLegend = {
  tokenTypes: string[];
  tokenModifiers: string[];
};

type SemanticTokenLanguageService = {
  getSemanticTokens?: (
    uri: URI,
    range:
      | { start: { line: number; character: number }; end: { line: number; character: number } }
      | undefined,
    legend: SemanticTokensLegend,
    reportProgress?: (tokens: unknown) => void,
    token?: unknown
  ) => Promise<unknown>;
  semanticTokenLegend?: SemanticTokensLegend;
};

function resolveSemanticTokenLegend(
  languageService: SemanticTokenLanguageService
): SemanticTokensLegend {
  const legend = languageService.semanticTokenLegend;
  if (legend && Array.isArray(legend.tokenTypes) && Array.isArray(legend.tokenModifiers)) {
    return {
      tokenTypes: [...legend.tokenTypes],
      tokenModifiers: [...legend.tokenModifiers],
    };
  }

  return {
    tokenTypes: [],
    tokenModifiers: [],
  };
}

// Trace semantics used by trace(message, level):
// - Default level is 'messages', so trace(...) emits when trace mode is not 'off'.
// - 'messages' level always emits unless serverTraceMode is 'off'.
// - 'verbose' level emits only when serverTraceMode is exactly 'verbose'.
function shouldTrace(level: 'messages' | 'verbose' = 'messages'): boolean {
  if (serverTraceMode === 'off') {
    return false;
  }

  return level === 'messages' || serverTraceMode === 'verbose';
}

function trace(message: string, level: 'messages' | 'verbose' = 'messages'): void {
  if (!shouldTrace(level)) {
    return;
  }

  connection.console.log(`[templjs-trace] ${message}`);
}

async function collectServiceDiagnosticsForDocument(
  uri: string,
  _text: string
): Promise<Diagnostic[]> {
  try {
    trace(`[diag] start uri=${uri}`, 'verbose');
    const languageService = await server.project.getLanguageService(URI.parse(uri));
    trace(`[diag] language service resolved uri=${uri}`, 'verbose');
    const context = (languageService as { context?: unknown }).context as
      | {
          language?: {
            scripts?: {
              get: (targetUri: URI) =>
                | {
                    id?: URI;
                    languageId?: string;
                    generated?: {
                      code?: { id: string; languageId?: string; mappings?: unknown[] };
                    };
                    snapshot?: { getLength?: () => number };
                  }
                | undefined;
            };
          };
          documents?: {
            getVirtualCodeUri?: (sourceFileUri: string, virtualCodeId: string) => string;
            getMaps?: (virtualCode: unknown) => Iterable<unknown>;
          };
          disabledVirtualFileUris?: Set<string>;
        }
      | undefined;

    if (shouldTrace('verbose')) {
      const sourceFile = context?.language?.scripts?.get(URI.parse(uri));
      const generatedCode = sourceFile?.generated?.code;
      const virtualUri =
        generatedCode && context?.documents?.getVirtualCodeUri
          ? context.documents.getVirtualCodeUri(uri, generatedCode.id)
          : undefined;
      const mapCount =
        generatedCode && context?.documents?.getMaps
          ? [...context.documents.getMaps(generatedCode)].length
          : 0;

      trace(
        `[diag-state] uri=${uri}` +
          ` sourceFile=${sourceFile ? 'yes' : 'no'}` +
          ` sourceLanguageId=${sourceFile?.languageId ?? 'none'}` +
          ` sourceSnapshotLength=${sourceFile?.snapshot?.getLength?.() ?? -1}` +
          ` generatedCode=${generatedCode?.id ?? 'none'}` +
          ` generatedLanguage=${generatedCode?.languageId ?? 'none'}` +
          ` generatedMappings=${generatedCode?.mappings?.length ?? 0}` +
          ` virtualUri=${virtualUri ?? 'none'}` +
          ` virtualDisabled=${virtualUri ? (context?.disabledVirtualFileUris?.has(virtualUri) ?? false) : false}` +
          ` mapCount=${mapCount}`,
        'verbose'
      );
    }

    const diagnostics = (await languageService!.getDiagnostics(URI.parse(uri))) as Diagnostic[];
    trace(`[diag] doValidation uri=${uri} count=${diagnostics.length}`, 'verbose');

    if (isYamlTemplateUri(uri) && shouldTrace('verbose')) {
      const sourceFile = context?.language?.scripts?.get(URI.parse(uri));
      const generatedCode = sourceFile?.generated?.code;
      const virtualUri =
        generatedCode && context?.documents?.getVirtualCodeUri
          ? context.documents.getVirtualCodeUri(uri, generatedCode.id)
          : undefined;
      const mapCount =
        generatedCode && context?.documents?.getMaps
          ? [...context.documents.getMaps(generatedCode)].length
          : 0;
      const yamlCount = diagnostics.filter(
        (diagnostic) =>
          typeof diagnostic.source === 'string' && diagnostic.source.toLowerCase() === 'yaml'
      ).length;

      trace(
        `[templjs-yaml-debug] uri=${uri} diagnostics=${diagnostics.length} yamlDiagnostics=${yamlCount}` +
          ` sourceLanguageId=${sourceFile?.languageId ?? 'none'}` +
          ` hasGenerated=${generatedCode ? 'yes' : 'no'}` +
          ` generatedLanguageId=${generatedCode?.languageId ?? 'none'}` +
          ` generatedMappings=${generatedCode?.mappings?.length ?? 0}` +
          ` virtualUri=${virtualUri ?? 'none'}` +
          ` virtualDisabled=${virtualUri ? (context?.disabledVirtualFileUris?.has(virtualUri) ?? false) : false}` +
          ` mapCount=${mapCount}`,
        'verbose'
      );
    }

    return diagnostics;
  } catch (error) {
    trace(
      `[diag] error uri=${uri} message=${error instanceof Error ? error.message : String(error)}`,
      'verbose'
    );
    connection.console.log(
      `[templjs] Host diagnostics skipped for ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

connection.onInitialize(async (params) => {
  const typedParams = params as InitializeParamsLike;
  const activeDocumentUri = typedParams.initializationOptions?.documentContext?.uri;
  const derivedRoot = deriveWorkspaceRootFromDocumentUri(activeDocumentUri);
  const derivedRootUri = derivedRoot.rootUri;
  const derivedWorkspaceRoot = derivedRoot.workspaceRoot;

  storedWorkspaceRoot = resolveWorkspaceRoot(typedParams) ?? derivedWorkspaceRoot;
  const initializeRootUri =
    typedParams.rootUri ??
    (storedWorkspaceRoot ? pathToFileURL(storedWorkspaceRoot).toString() : undefined) ??
    derivedRootUri;
  const initializeParams =
    initializeRootUri && !typedParams.rootUri
      ? {
          ...params,
          rootUri: initializeRootUri,
          rootPath: undefined,
        }
      : params;

  storedInitializationOptions = typedParams.initializationOptions;
  serverTraceMode = typedParams.initializationOptions?.traceMode ?? 'off';

  trace(
    `[init] input rootUri=${typedParams.rootUri ?? 'null'} activeDocumentUri=${activeDocumentUri ?? 'none'} derivedRootUri=${derivedRootUri ?? 'none'} resolvedWorkspaceRoot=${storedWorkspaceRoot ?? 'none'} initializeRootUri=${initializeRootUri ?? 'none'}`,
    'verbose'
  );

  const activeDocumentContent = typedParams.initializationOptions?.documentContext?.content;
  if (activeDocumentUri && typeof activeDocumentContent === 'string') {
    trace(`[init] active document provided uri=${activeDocumentUri}`, 'verbose');
  }

  const languagePlugins = createTempljsLanguagePlugins({});
  const servicePlugins = createTempljsServicePlugins({
    workspaceFolder: storedWorkspaceRoot,
    initializationOptions: storedInitializationOptions,
    schemaCache: schemaSourceCache,
    /* v8 ignore next */
    log: (message) => connection.console.log(message),
  });

  connection.console.log('[templjs] Language server initialized');

  const initialized = await server.initialize(
    initializeParams,
    createSimpleProject(languagePlugins),
    servicePlugins
  );

  // Delegate authoring requests to Volar language service from this transport layer.
  // This keeps a single implementation of semantics while ensuring requests are handled.
  connection.onCompletion(async (request, token) => {
    const uri = request.textDocument.uri;
    trace(`[authoring] completion uri=${uri}`, 'verbose');
    const languageService = await server.project.getLanguageService(URI.parse(uri));
    return await languageService!.getCompletionItems(
      URI.parse(uri),
      request.position,
      request.context,
      token
    );
  });

  connection.onHover(async (request, token) => {
    const uri = request.textDocument.uri;
    trace(`[authoring] hover uri=${uri}`, 'verbose');
    const languageService = await server.project.getLanguageService(URI.parse(uri));
    return await languageService!.getHover(URI.parse(uri), request.position, token);
  });

  connection.onDefinition(async (request, token) => {
    const uri = request.textDocument.uri;
    trace(`[authoring] definition uri=${uri}`, 'verbose');
    const languageService = await server.project.getLanguageService(URI.parse(uri));
    return await languageService!.getDefinition(URI.parse(uri), request.position, token);
  });

  const semanticTokensConnection = connection as unknown as {
    onRequest?: (
      method: string,
      handler: (
        request: {
          textDocument: { uri: string };
          range?: {
            start: { line: number; character: number };
            end: { line: number; character: number };
          };
        },
        token: unknown
      ) => Promise<unknown>
    ) => void;
  };
  const registerRequest = semanticTokensConnection.onRequest;
  const supportsSemanticTokenRequests = typeof registerRequest === 'function';
  if (supportsSemanticTokenRequests) {
    registerRequest('textDocument/semanticTokens/full', async (request, token) => {
      const uri = request.textDocument.uri;
      trace(`[authoring] semanticTokens/full uri=${uri}`, 'verbose');
      const languageService = (await server.project.getLanguageService(
        URI.parse(uri)
      )) as SemanticTokenLanguageService;
      if (typeof languageService.getSemanticTokens !== 'function') {
        trace(`[authoring] semanticTokens/full unavailable uri=${uri}`, 'verbose');
        return null;
      }

      return await languageService.getSemanticTokens(
        URI.parse(uri),
        undefined,
        resolveSemanticTokenLegend(languageService),
        undefined,
        token
      );
    });

    registerRequest('textDocument/semanticTokens/range', async (request, token) => {
      const uri = request.textDocument.uri;
      trace(`[authoring] semanticTokens/range uri=${uri}`, 'verbose');
      const languageService = (await server.project.getLanguageService(
        URI.parse(uri)
      )) as SemanticTokenLanguageService;
      if (typeof languageService.getSemanticTokens !== 'function') {
        trace(`[authoring] semanticTokens/range unavailable uri=${uri}`, 'verbose');
        return null;
      }

      return await languageService.getSemanticTokens(
        URI.parse(uri),
        request.range,
        resolveSemanticTokenLegend(languageService),
        undefined,
        token
      );
    });
  } else {
    trace('[authoring] semantic token request handlers unavailable on connection', 'verbose');
  }

  const formattingConnection = connection as unknown as {
    onDocumentFormatting?: (
      handler: (
        request: {
          textDocument: { uri: string };
          options: { insertSpaces: boolean; tabSize: number };
        },
        token: unknown
      ) => Promise<unknown>
    ) => void;
  };
  const registerDocumentFormatting = formattingConnection.onDocumentFormatting;
  const supportsDocumentFormatting = typeof registerDocumentFormatting === 'function';
  if (supportsDocumentFormatting) {
    registerDocumentFormatting(async (request, token) => {
      const uri = request.textDocument.uri;
      trace(`[authoring] format request uri=${uri}`, 'verbose');
      const languageService = await server.project.getLanguageService(URI.parse(uri));
      const formattingResult = await languageService!.getDocumentFormattingEdits(
        URI.parse(uri),
        request.options,
        undefined,
        undefined,
        token as Parameters<NonNullable<typeof languageService>['getDocumentFormattingEdits']>[4]
      );
      trace(
        `[authoring] format result uri=${uri} edits=${Array.isArray(formattingResult) ? formattingResult.length : 0}`,
        'verbose'
      );
      return formattingResult;
    });
  } else {
    trace('[authoring] format handler unavailable on connection', 'verbose');
  }

  return {
    ...initialized,
    capabilities: {
      ...(initialized?.capabilities ?? {}),
      textDocumentSync: 2,
      completionProvider: {
        triggerCharacters: [...TEMPLJS_COMPLETION_TRIGGER_CHARACTERS],
      },
      hoverProvider: true,
      definitionProvider: true,
      semanticTokensProvider: initialized?.capabilities?.semanticTokensProvider,
      documentFormattingProvider: supportsDocumentFormatting,
    },
  };
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);

let started = false;

export function startTempljsLanguageServer(): void {
  if (started) {
    return;
  }

  started = true;
  connection.listen();
}

export const serverTesting = {
  isLikelySchemaUri,
  isYamlTemplateUri,
  collectServiceDiagnosticsForDocument,
  resetRuntimeState() {
    storedWorkspaceRoot = undefined;
    storedInitializationOptions = undefined;
    serverTraceMode = 'off';
    schemaSourceCache.clear();
  },
  getSchemaSourceCache() {
    return schemaSourceCache;
  },
  setStoredWorkspaceRoot(workspaceRoot: string | undefined) {
    storedWorkspaceRoot = workspaceRoot;
  },
  setServerTraceMode(traceMode: TraceMode) {
    serverTraceMode = traceMode;
  },
  setStoredInitializationOptions(options: ServerInitializationOptions | undefined) {
    storedInitializationOptions = options;
  },
};
