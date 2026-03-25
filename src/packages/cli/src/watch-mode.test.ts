import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  WATCH_ERROR_PREFIXES,
  WatchModeDependencies,
  defaultWatchModeDependencies,
  startRenderWatchMode,
} from './watch-mode.js';

interface FakeWatcher {
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: () => void;
  emitError: (error: Error) => void;
}

function createFakeWatcher(listener: () => void): FakeWatcher {
  let errorListener: ((error: Error) => void) | undefined;
  const watcher = {} as FakeWatcher;

  watcher.close = vi.fn();
  watcher.on = vi.fn((_event: string, handler: (error: Error) => void) => {
    errorListener = handler;
    return watcher;
  });
  watcher.off = vi.fn((_event: string, handler: (error: Error) => void) => {
    if (errorListener === handler) {
      errorListener = undefined;
    }
    return watcher;
  });
  watcher.emit = listener;
  watcher.emitError = (error: Error) => {
    errorListener?.(error);
  };

  return watcher;
}

const EXPECTED_WATCH_ERROR_PREFIXES = {
  RENDER_ERROR_PREFIX: 'Error: ',
  WATCHER_ERROR_PREFIX: 'Watch error: ',
  RENDER_LOOP_ERROR_PREFIX: 'Unexpected watch render loop error: ',
  STARTUP_ERROR_PREFIX: 'Unexpected watch mode startup error: ',
} as const;

function createMockDeps(
  capturedErrorMessages: string[],
  signalHandlers: Partial<Record<NodeJS.Signals, () => void>>,
  watchers: Map<string, FakeWatcher>,
  overrides: Partial<{
    fileExists: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    watchFile: ReturnType<typeof vi.fn>;
    writeOutput: ReturnType<typeof vi.fn>;
    writeStdout: ReturnType<typeof vi.fn>;
    writeStderr: ReturnType<typeof vi.fn>;
    addSignalListener: ReturnType<typeof vi.fn>;
    removeSignalListener: ReturnType<typeof vi.fn>;
    setProcessExitCode: ReturnType<typeof vi.fn>;
  }> = {}
) {
  const baseWatchFile = vi.fn((path: string, listener: () => void) => {
    const watcher = createFakeWatcher(listener);
    watchers.set(path, watcher);
    return watcher as unknown as ReturnType<WatchModeDependencies['watchFile']>;
  });

  const baseWriteStderr = vi.fn((data: string) => {
    capturedErrorMessages.push(data);
    return true;
  });

  const baseAddSignalListener = vi.fn((signal: NodeJS.Signals, handler: () => void) => {
    signalHandlers[signal] = handler;
  });

  return {
    fileExists: vi.fn(() => true),
    render: vi.fn().mockResolvedValue('rendered-content'),
    watchFile: baseWatchFile,
    writeOutput: vi.fn(),
    writeStdout: vi.fn(() => true),
    writeStderr: baseWriteStderr,
    addSignalListener: baseAddSignalListener,
    removeSignalListener: vi.fn(),
    setProcessExitCode: vi.fn(),
    ...overrides,
  };
}

describe('watch-mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps WATCH_ERROR_PREFIXES aligned with emitted watch-mode errors', async () => {
    expect(WATCH_ERROR_PREFIXES).toEqual(EXPECTED_WATCH_ERROR_PREFIXES);

    const capturedErrorMessages: string[] = [];

    const signalHandlers1: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers1 = new Map<string, FakeWatcher>();
    const deps1 = createMockDeps(capturedErrorMessages, signalHandlers1, watchers1, {
      render: vi.fn().mockRejectedValue(new Error('boom')),
    });

    const runPromise1 = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps1
    );

    await vi.waitFor(() => {
      expect(deps1.writeStderr).toHaveBeenCalledWith('Error: boom\n');
      expect(signalHandlers1.SIGINT).toBeTypeOf('function');
    });
    signalHandlers1.SIGINT?.();
    await runPromise1;

    const signalHandlers2: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers2 = new Map<string, FakeWatcher>();
    const deps2 = createMockDeps(capturedErrorMessages, signalHandlers2, watchers2);

    const runPromise2 = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps2
    );

    await vi.waitFor(() => {
      expect(watchers2.get('template.templ')).toBeDefined();
    });
    watchers2.get('template.templ')?.emitError(new Error('watch exploded'));
    await runPromise2;

    const signalHandlers3: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers3 = new Map<string, FakeWatcher>();
    const deps3 = createMockDeps(capturedErrorMessages, signalHandlers3, watchers3, {
      writeStderr: vi.fn((data: string) => {
        capturedErrorMessages.push(data);
        if (data.startsWith('Watching ')) {
          throw new Error('stderr exploded');
        }
        return true;
      }),
      addSignalListener: vi.fn(),
    });

    await startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps3
    );

    const signalHandlers4: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers4 = new Map<string, FakeWatcher>();
    const deps4 = createMockDeps(capturedErrorMessages, signalHandlers4, watchers4, {
      render: vi
        .fn()
        .mockResolvedValueOnce('rendered-content')
        .mockRejectedValueOnce({
          toString: () => {
            throw new Error('render loop stringify failure');
          },
        }),
    });

    const runPromise4 = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 1,
      },
      deps4
    );

    await vi.waitFor(() => {
      expect(watchers4.get('template.templ')).toBeDefined();
      expect(signalHandlers4.SIGINT).toBeTypeOf('function');
    });
    watchers4.get('template.templ')?.emit();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => {
      expect(capturedErrorMessages).toEqual(
        expect.arrayContaining([expect.stringMatching(/^Unexpected watch render loop error: /)])
      );
    });
    signalHandlers4.SIGINT?.();
    await runPromise4;

    const emittedErrors = capturedErrorMessages.filter((message) =>
      Object.values(EXPECTED_WATCH_ERROR_PREFIXES).some((prefix) => message.startsWith(prefix))
    );

    expect(emittedErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Error: /),
        expect.stringMatching(/^Watch error: /),
        expect.stringMatching(/^Unexpected watch render loop error: /),
        expect.stringMatching(/^Unexpected watch mode startup error: /),
      ])
    );
  });

  it('rejects inline JSON input for watch mode', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      fileExists: vi.fn((path) => path === 'template.templ'),
    });

    await expect(
      startRenderWatchMode(
        {
          template: 'template.templ',
          input: '{"name":"World"}',
        },
        deps
      )
    ).rejects.toThrow('Watch mode requires an existing input file path');
  });

  it('rejects missing template file for watch mode', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      fileExists: vi.fn((path) => path !== 'missing.templ'),
    });

    await expect(
      startRenderWatchMode(
        {
          template: 'missing.templ',
          input: 'data.json',
        },
        deps
      )
    ).rejects.toThrow('Watch mode requires an existing template file path');
  });

  it('renders initially and on debounced change, then cleans up on SIGINT', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockResolvedValue('rendered-content'),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 50,
      },
      deps
    );
    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(1);
    });
    expect(deps.writeStdout).toHaveBeenCalledWith('rendered-content\n');

    watchers.get('template.templ')?.emit();
    watchers.get('data.json')?.emit();
    await vi.advanceTimersByTimeAsync(49);
    expect(deps.render).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(deps.render).toHaveBeenCalledTimes(2);

    signalHandlers.SIGINT?.();
    await runPromise;

    expect(deps.setProcessExitCode).toHaveBeenCalledWith(130);
    expect(watchers.get('template.templ')?.close).toHaveBeenCalledTimes(1);
    expect(watchers.get('data.json')?.close).toHaveBeenCalledTimes(1);
  });

  it('writes to output file when output path is provided', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockResolvedValue('rendered-to-file'),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        output: 'result.txt',
      },
      deps
    );

    await vi.waitFor(() => {
      expect(deps.writeOutput).toHaveBeenCalledWith('result.txt', 'rendered-to-file', 'utf-8');
    });
    expect(deps.writeStdout).not.toHaveBeenCalledWith('rendered-to-file\n');

    expect(signalHandlers.SIGTERM).toBeTypeOf('function');
    signalHandlers.SIGTERM?.();
    await runPromise;

    expect(deps.setProcessExitCode).toHaveBeenCalledWith(143);
    expect(watchers.get('template.templ')?.close).toHaveBeenCalledTimes(1);
    expect(watchers.get('data.json')?.close).toHaveBeenCalledTimes(1);
  });

  it('re-renders after in-flight render settles when updates arrive during render', async () => {
    let resolveRender: (() => void) | undefined;
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRender = () => resolve('delayed-render');
          })
      ),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 1,
      },
      deps
    );

    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(1);
    });

    watchers.get('template.templ')?.emit();
    await vi.advanceTimersByTimeAsync(1);

    resolveRender?.();
    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(2);
    });
    resolveRender?.();
    await vi.waitFor(() => {
      expect(signalHandlers.SIGINT).toBeTypeOf('function');
    });
    // First SIGINT triggers cleanup: both signal listeners are removed (SIGINT + SIGTERM = 2)
    signalHandlers.SIGINT?.();
    await runPromise;
    expect(deps.removeSignalListener).toHaveBeenCalledTimes(2);

    // Second SIGINT must be a no-op: the removal count must not increase
    signalHandlers.SIGINT?.();
    expect(deps.removeSignalListener).toHaveBeenCalledTimes(2);
  });

  it('reports render errors and ignores queued timers after cleanup', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockRejectedValue(new Error('boom')),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 500,
      },
      deps
    );

    await vi.waitFor(() => {
      expect(deps.writeStderr).toHaveBeenCalledWith('Error: boom\n');
    });

    watchers.get('template.templ')?.emit();
    signalHandlers.SIGTERM?.();
    watchers.get('data.json')?.emit();
    await vi.advanceTimersByTimeAsync(500);
    await runPromise;

    expect(deps.render).toHaveBeenCalledTimes(1);
  });

  it('continues watch mode when rerender error logging throws', async () => {
    let resolveRender: (() => void) | undefined;
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<string>((resolve) => {
              resolveRender = () => resolve('initial-render');
            })
        )
        .mockRejectedValueOnce(new Error('boom')),
      writeStderr: vi.fn((data: string) => {
        if (data === 'Error: boom\n') {
          throw new Error('stderr exploded');
        }
        return true;
      }),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 1,
      },
      deps
    );

    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(1);
    });

    watchers.get('template.templ')?.emit();
    await vi.advanceTimersByTimeAsync(1);

    resolveRender?.();
    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(2);
    });

    await vi.waitFor(() => {
      expect(deps.writeStderr).toHaveBeenCalledWith('Error: boom\n');
    });
    expect(deps.writeStderr).not.toHaveBeenCalledWith(
      'Unexpected watch render loop error: stderr exploded\n'
    );

    await vi.waitFor(() => {
      expect(signalHandlers.SIGINT).toBeTypeOf('function');
    });
    signalHandlers.SIGINT?.();
    await runPromise;
  });

  it('cleans up the first watcher if subsequent watcher setup fails', async () => {
    const firstWatcher = createFakeWatcher(() => undefined);
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockResolvedValue('rendered'),
      watchFile: vi
        .fn()
        .mockReturnValueOnce(
          firstWatcher as unknown as ReturnType<WatchModeDependencies['watchFile']>
        )
        .mockImplementationOnce(() => {
          throw new Error('watch setup failed');
        }),
    });

    await expect(
      startRenderWatchMode(
        {
          template: 'template.templ',
          input: 'data.json',
        },
        deps
      )
    ).rejects.toThrow('watch setup failed');

    expect(firstWatcher.close).toHaveBeenCalledTimes(1);
  });

  it('handles watcher error events with cleanup and exit code 1', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockResolvedValue('rendered-content'),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps
    );

    await vi.waitFor(() => {
      expect(signalHandlers.SIGINT).toBeTypeOf('function');
    });

    watchers.get('template.templ')?.emitError(new Error('watch exploded'));
    await runPromise;

    expect(deps.writeStderr).toHaveBeenCalledWith('Watch error: watch exploded\n');
    expect(deps.setProcessExitCode).toHaveBeenCalledWith(1);
    expect(watchers.get('template.templ')?.close).toHaveBeenCalledTimes(1);
    expect(watchers.get('data.json')?.close).toHaveBeenCalledTimes(1);
  });

  it('handles watcher errors that occur during the initial render', async () => {
    let resolveRender: (() => void) | undefined;
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRender = () => resolve('rendered-content');
          })
      ),
      addSignalListener: vi.fn(),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps
    );

    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(1);
    });

    watchers.get('template.templ')?.emitError(new Error('watch exploded early'));
    await runPromise;
    resolveRender?.(); // Watcher error triggers cleanup before render completes, so resolve the still-pending render promise to avoid unhandled rejection warnings.

    expect(deps.writeStderr).toHaveBeenCalledWith('Watch error: watch exploded early\n');
    expect(deps.setProcessExitCode).toHaveBeenCalledWith(1);
    expect(watchers.get('template.templ')?.close).toHaveBeenCalledTimes(1);
    expect(watchers.get('data.json')?.close).toHaveBeenCalledTimes(1);
  });

  it('keeps watcher lifecycle active when initial render error logging throws', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockRejectedValue(new Error('boom')),
      writeStderr: vi.fn((data: string) => {
        if (data === 'Error: boom\n') {
          throw new Error('stderr exploded');
        }
        return true;
      }),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps
    );

    await vi.waitFor(() => {
      expect(signalHandlers.SIGTERM).toBeTypeOf('function');
    });

    signalHandlers.SIGTERM?.();
    await runPromise;

    expect(deps.setProcessExitCode).toHaveBeenCalledWith(143);
    expect(watchers.get('template.templ')?.close).toHaveBeenCalledTimes(1);
    expect(watchers.get('data.json')?.close).toHaveBeenCalledTimes(1);
  });

  it('skips queued rerenders after cleanup while a render is still in flight', async () => {
    let resolveRender: (() => void) | undefined;
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRender = () => resolve('rendered-content');
          })
      ),
    });

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 1,
      },
      deps
    );

    await vi.waitFor(() => {
      expect(deps.render).toHaveBeenCalledTimes(1);
    });

    watchers.get('template.templ')?.emit();
    await vi.advanceTimersByTimeAsync(1);
    signalHandlers.SIGINT?.();
    resolveRender?.();
    await runPromise;

    expect(deps.render).toHaveBeenCalledTimes(1);
    expect(deps.setProcessExitCode).toHaveBeenCalledWith(130);
  });

  it('reports startup banner failures and exits cleanly', async () => {
    const capturedErrorMessages: string[] = [];
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();
    const deps = createMockDeps(capturedErrorMessages, signalHandlers, watchers, {
      render: vi.fn().mockResolvedValue('rendered-content'),
      writeStderr: vi.fn((data: string) => {
        if (data.startsWith('Watching ')) {
          throw new Error('stderr exploded');
        }
        return true;
      }),
      addSignalListener: vi.fn(),
    });

    await startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
      },
      deps
    );

    expect(deps.writeStderr).toHaveBeenCalledWith(
      'Unexpected watch mode startup error: stderr exploded\n'
    );
    expect(deps.setProcessExitCode).toHaveBeenCalledWith(1);
    expect(watchers.get('template.templ')?.close).toHaveBeenCalledTimes(1);
    expect(watchers.get('data.json')?.close).toHaveBeenCalledTimes(1);
  });

  it('default dependencies delegate to fs/process primitives', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'templjs-watch-mode-'));
    const watchedPath = join(tempDir, 'watch.json');
    const outputPath = join(tempDir, 'out.txt');
    writeFileSync(watchedPath, '{"name":"temp"}', 'utf-8');

    const onSpy = vi.spyOn(process, 'on');
    const offSpy = vi.spyOn(process, 'off');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const previousExitCode = process.exitCode;

    try {
      expect(defaultWatchModeDependencies.fileExists(watchedPath)).toBe(true);
      await expect(
        defaultWatchModeDependencies.render('template.templ', watchedPath)
      ).rejects.toThrow('Watch mode dependency "render" must be overridden');

      const watcher = defaultWatchModeDependencies.watchFile(watchedPath, () => {});
      watcher.close();

      defaultWatchModeDependencies.writeOutput(outputPath, 'hello', 'utf-8');
      expect(readFileSync(outputPath, 'utf-8')).toBe('hello');

      defaultWatchModeDependencies.writeStdout('stdout');
      defaultWatchModeDependencies.writeStderr('stderr');
      expect(stdoutSpy).toHaveBeenCalledWith('stdout');
      expect(stderrSpy).toHaveBeenCalledWith('stderr');

      const handler = (): void => undefined;
      defaultWatchModeDependencies.addSignalListener('SIGINT', handler);
      defaultWatchModeDependencies.removeSignalListener('SIGINT', handler);
      expect(onSpy).toHaveBeenCalledWith('SIGINT', handler);
      expect(offSpy).toHaveBeenCalledWith('SIGINT', handler);

      defaultWatchModeDependencies.setProcessExitCode(9);
      expect(process.exitCode).toBe(9);
    } finally {
      process.exitCode = previousExitCode;
      onSpy.mockRestore();
      offSpy.mockRestore();
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('performs an initial render with real fs and a custom render function', async () => {
    vi.useRealTimers();

    const tempDir = mkdtempSync(join(tmpdir(), 'templjs-watch-integ-'));
    const templatePath = join(tempDir, 'template.templ');
    const dataPath = join(tempDir, 'data.json');
    const outputPath = join(tempDir, 'output.txt');

    writeFileSync(templatePath, 'Hello {{ name }}', 'utf-8');
    writeFileSync(dataPath, '{"name":"World"}', 'utf-8');

    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const stderrLines: string[] = [];
    const exitCodeSpy = vi.fn();

    const deps: WatchModeDependencies = {
      ...defaultWatchModeDependencies,
      render: async (_templatePath: string, inputPath: string) => {
        return readFileSync(inputPath, 'utf-8');
      },
      writeStdout: (data) => {
        process.stdout.write(data);
        return true;
      },
      writeStderr: (data) => {
        stderrLines.push(data);
        return true;
      },
      addSignalListener: (signal, handler) => {
        signalHandlers[signal] = handler;
      },
      removeSignalListener: () => {},
      setProcessExitCode: exitCodeSpy,
    };

    const runPromise = startRenderWatchMode(
      { template: templatePath, input: dataPath, output: outputPath, debounceMs: 0 },
      deps
    );

    try {
      await vi.waitFor(
        () => {
          expect(signalHandlers.SIGINT).toBeTypeOf('function');
          expect(readFileSync(outputPath, 'utf-8')).toBe('{"name":"World"}');
        },
        { timeout: 2000 }
      );

      signalHandlers.SIGINT?.();
      await runPromise;

      expect(stderrLines.some((line) => line.startsWith('Watching '))).toBe(true);
      expect(exitCodeSpy).toHaveBeenCalledWith(130);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
