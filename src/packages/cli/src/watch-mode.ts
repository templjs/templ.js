import { existsSync, watch, writeFileSync, type FSWatcher } from 'fs';

export interface WatchModeOptions {
  template: string;
  input: string;
  output?: string;
  debounceMs?: number;
}

export interface WatchModeDependencies {
  fileExists: (path: string) => boolean;
  render: (templatePath: string, dataOrPath: string) => Promise<string>;
  watchFile: (path: string, listener: () => void) => FSWatcher;
  writeOutput: (path: string, data: string, encoding: BufferEncoding) => void;
  writeStdout: (data: string) => boolean;
  writeStderr: (data: string) => boolean;
  addSignalListener: (signal: NodeJS.Signals, handler: () => void) => void;
  removeSignalListener: (signal: NodeJS.Signals, handler: () => void) => void;
  setProcessExitCode: (code: number) => void;
}

export const DEFAULT_DEBOUNCE_MS = 75;

export const WATCH_ERROR_PREFIXES = [
  'Error: ',
  'Watch error: ',
  'Unexpected watch render loop error: ',
  'Unexpected watch mode startup error: ',
] as const;

export const defaultWatchModeDependencies: WatchModeDependencies = {
  fileExists: existsSync,
  render: async () => {
    throw new Error('Watch mode dependency "render" must be overridden');
  },
  watchFile: (path, listener) => watch(path, listener),
  writeOutput: (path, data, encoding) => writeFileSync(path, data, encoding),
  writeStdout: (data) => process.stdout.write(data),
  writeStderr: (data) => process.stderr.write(data),
  addSignalListener: (signal, handler) => process.on(signal, handler),
  removeSignalListener: (signal, handler) => process.off(signal, handler),
  setProcessExitCode: (code) => {
    process.exitCode = code;
  },
};

export async function startRenderWatchMode(
  options: WatchModeOptions,
  deps: WatchModeDependencies
): Promise<void> {
  if (!deps.fileExists(options.template)) {
    throw new Error(
      `Watch mode requires an existing template file path. Received "${options.template}". Please provide a valid template file.`
    );
  }

  if (!deps.fileExists(options.input)) {
    throw new Error(
      `Watch mode requires an existing input file path. Received "${options.input}". Stdin (-) is not supported in --watch mode.`
    );
  }

  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let isRendering = false;
  let rerenderQueued = false;
  let closed = false;
  let debounceTimer: NodeJS.Timeout | undefined;

  async function executeRender(): Promise<void> {
    if (closed) {
      return;
    }

    if (isRendering) {
      rerenderQueued = true;
      return;
    }

    isRendering = true;
    try {
      const rendered = await deps.render(options.template, options.input);
      if (options.output) {
        deps.writeOutput(options.output, rendered, 'utf-8');
      } else {
        deps.writeStdout(`${rendered}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        deps.writeStderr(`Error: ${message}\n`);
      } catch {
        // Best effort only; avoid surfacing unhandled rejection from logging.
      }
    } finally {
      isRendering = false;
      if (rerenderQueued) {
        rerenderQueued = false;
        triggerRender();
      }
    }
  }

  function triggerRender(): void {
    void (async () => {
      try {
        await executeRender();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        try {
          deps.writeStderr(`Unexpected watch render loop error: ${message}\n`);
        } catch {
          // Best effort only; avoid surfacing unhandled rejection from logging.
        }
      }
    })();
  }

  const scheduleRender = (): void => {
    if (closed) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      triggerRender();
    }, debounceMs);
  };

  let templateWatcher: FSWatcher | undefined;
  let inputWatcher: FSWatcher | undefined;

  try {
    templateWatcher = deps.watchFile(options.template, scheduleRender);
    inputWatcher = deps.watchFile(options.input, scheduleRender);
  } catch (error) {
    templateWatcher?.close();
    throw error;
  }

  await new Promise<void>((resolve) => {
    const cleanup = (exitCode: number): void => {
      if (closed) {
        return;
      }
      closed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      templateWatcher?.off('error', onWatcherError);
      inputWatcher?.off('error', onWatcherError);
      templateWatcher?.close();
      inputWatcher?.close();
      deps.removeSignalListener('SIGINT', onSigInt);
      deps.removeSignalListener('SIGTERM', onSigTerm);
      deps.setProcessExitCode(exitCode);
      resolve();
    };

    const onSigInt = (): void => cleanup(130);
    const onSigTerm = (): void => cleanup(143);
    const onWatcherError = (error: Error): void => {
      try {
        deps.writeStderr(`Watch error: ${error.message}\n`);
      } catch {
        // Best effort only; avoid surfacing unhandled rejection from logging.
      }
      cleanup(1);
    };

    templateWatcher?.on('error', onWatcherError);
    inputWatcher?.on('error', onWatcherError);
    deps.addSignalListener('SIGINT', onSigInt);
    deps.addSignalListener('SIGTERM', onSigTerm);

    const startWatching = async (): Promise<void> => {
      try {
        await executeRender();
        if (!closed) {
          deps.writeStderr(
            `Watching ${options.template} and ${options.input}. Press Ctrl+C to stop.\n`
          );
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        try {
          deps.writeStderr(`Unexpected watch mode startup error: ${message}\n`);
        } catch {
          // Best effort only; avoid surfacing unhandled rejection from logging.
        }
        cleanup(1);
      }
    };

    void startWatching();
  });
}
