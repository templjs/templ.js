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

const DEFAULT_DEBOUNCE_MS = 75;

export const defaultWatchModeDependencies: WatchModeDependencies = {
  fileExists: existsSync,
  render: async () => '', // Stub - must be overridden
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
  if (!deps.fileExists(options.input)) {
    throw new Error(
      `Watch mode requires an input file path. Received "${options.input}". Inline JSON is not supported in --watch mode`
    );
  }

  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let isRendering = false;
  let rerenderQueued = false;
  let closed = false;
  let debounceTimer: NodeJS.Timeout | undefined;

  const executeRender = async (): Promise<void> => {
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
      deps.writeStderr(`Error: ${message}\n`);
    } finally {
      isRendering = false;
      if (rerenderQueued) {
        rerenderQueued = false;
        void executeRender();
      }
    }
  };

  const scheduleRender = (): void => {
    if (closed) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void executeRender();
    }, debounceMs);
  };

  const templateWatcher = deps.watchFile(options.template, scheduleRender);
  const inputWatcher = deps.watchFile(options.input, scheduleRender);

  await executeRender();

  deps.writeStderr(`Watching ${options.template} and ${options.input}. Press Ctrl+C to stop.\n`);

  await new Promise<void>((resolve) => {
    const cleanup = (exitCode: number): void => {
      if (closed) {
        return;
      }
      closed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      templateWatcher.close();
      inputWatcher.close();
      deps.removeSignalListener('SIGINT', onSigInt);
      deps.removeSignalListener('SIGTERM', onSigTerm);
      deps.setProcessExitCode(exitCode);
      resolve();
    };

    const onSigInt = (): void => cleanup(130);
    const onSigTerm = (): void => cleanup(0);

    deps.addSignalListener('SIGINT', onSigInt);
    deps.addSignalListener('SIGTERM', onSigTerm);
  });
}
