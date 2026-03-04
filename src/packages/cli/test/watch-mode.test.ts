import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { startRenderWatchMode } from '../src/watch-mode.js';
import { defaultWatchModeDependencies } from '../src/watch-mode.js';

interface FakeWatcher {
  close: ReturnType<typeof vi.fn>;
  emit: () => void;
}

describe('watch-mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('rejects inline JSON input for watch mode', async () => {
    const deps = {
      fileExists: vi.fn(() => false),
      render: vi.fn(),
      watchFile: vi.fn(),
      writeOutput: vi.fn(),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      setProcessExitCode: vi.fn(),
    };

    await expect(
      startRenderWatchMode(
        {
          template: 'template.templ',
          input: '{"name":"World"}',
        },
        deps
      )
    ).rejects.toThrow('Watch mode requires an input file path');
  });

  it('renders initially and on debounced change, then cleans up on SIGINT', async () => {
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();

    const watchFile = vi.fn((path: string, listener: () => void) => {
      const watcher: FakeWatcher = {
        close: vi.fn(),
        emit: listener,
      };
      watchers.set(path, watcher);
      return watcher as unknown as ReturnType<typeof watchFile>;
    });

    const deps = {
      fileExists: vi.fn(() => true),
      render: vi.fn().mockResolvedValue('rendered-content'),
      watchFile,
      writeOutput: vi.fn(),
      writeStdout: vi.fn(() => true),
      writeStderr: vi.fn(() => true),
      addSignalListener: vi.fn((signal: NodeJS.Signals, handler: () => void) => {
        signalHandlers[signal] = handler;
      }),
      removeSignalListener: vi.fn(),
      setProcessExitCode: vi.fn(),
    };

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 50,
      },
      deps
    );

    await Promise.resolve();

    expect(deps.render).toHaveBeenCalledTimes(1);
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
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers: FakeWatcher[] = [];

    const deps = {
      fileExists: vi.fn(() => true),
      render: vi.fn().mockResolvedValue('rendered-to-file'),
      watchFile: vi.fn((_path: string, listener: () => void) => {
        const watcher: FakeWatcher = {
          close: vi.fn(),
          emit: listener,
        };
        watchers.push(watcher);
        return watcher as unknown as ReturnType<typeof deps.watchFile>;
      }),
      writeOutput: vi.fn(),
      writeStdout: vi.fn(() => true),
      writeStderr: vi.fn(() => true),
      addSignalListener: vi.fn((signal: NodeJS.Signals, handler: () => void) => {
        signalHandlers[signal] = handler;
      }),
      removeSignalListener: vi.fn(),
      setProcessExitCode: vi.fn(),
    };

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        output: 'result.txt',
      },
      deps
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(deps.writeOutput).toHaveBeenCalledWith('result.txt', 'rendered-to-file', 'utf-8');
    expect(deps.writeStdout).not.toHaveBeenCalledWith('rendered-to-file\n');

    expect(signalHandlers.SIGTERM).toBeTypeOf('function');
    signalHandlers.SIGTERM?.();
    await runPromise;

    expect(deps.setProcessExitCode).toHaveBeenCalledWith(0);
    expect(watchers[0]?.close).toHaveBeenCalledTimes(1);
    expect(watchers[1]?.close).toHaveBeenCalledTimes(1);
  });

  it('re-renders after in-flight render settles when updates arrive during render', async () => {
    let resolveRender: (() => void) | undefined;
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();

    const deps = {
      fileExists: vi.fn(() => true),
      render: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRender = () => resolve('delayed-render');
          })
      ),
      watchFile: vi.fn((path: string, listener: () => void) => {
        const watcher: FakeWatcher = {
          close: vi.fn(),
          emit: listener,
        };
        watchers.set(path, watcher);
        return watcher as unknown as ReturnType<typeof deps.watchFile>;
      }),
      writeOutput: vi.fn(),
      writeStdout: vi.fn(() => true),
      writeStderr: vi.fn(() => true),
      addSignalListener: vi.fn((signal: NodeJS.Signals, handler: () => void) => {
        signalHandlers[signal] = handler;
      }),
      removeSignalListener: vi.fn(),
      setProcessExitCode: vi.fn(),
    };

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 1,
      },
      deps
    );

    await Promise.resolve();
    watchers.get('template.templ')?.emit();
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.render).toHaveBeenCalledTimes(1);

    resolveRender?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(deps.render).toHaveBeenCalledTimes(2);

    signalHandlers.SIGINT?.();
    signalHandlers.SIGINT?.();
    await runPromise;

    expect(deps.removeSignalListener).toHaveBeenCalledTimes(2);
  });

  it('reports render errors and ignores queued timers after cleanup', async () => {
    const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    const watchers = new Map<string, FakeWatcher>();

    const deps = {
      fileExists: vi.fn(() => true),
      render: vi.fn().mockRejectedValue('boom'),
      watchFile: vi.fn((path: string, listener: () => void) => {
        const watcher: FakeWatcher = {
          close: vi.fn(),
          emit: listener,
        };
        watchers.set(path, watcher);
        return watcher as unknown as ReturnType<typeof deps.watchFile>;
      }),
      writeOutput: vi.fn(),
      writeStdout: vi.fn(() => true),
      writeStderr: vi.fn(() => true),
      addSignalListener: vi.fn((signal: NodeJS.Signals, handler: () => void) => {
        signalHandlers[signal] = handler;
      }),
      removeSignalListener: vi.fn(),
      setProcessExitCode: vi.fn(),
    };

    const runPromise = startRenderWatchMode(
      {
        template: 'template.templ',
        input: 'data.json',
        debounceMs: 500,
      },
      deps
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(deps.writeStderr).toHaveBeenCalledWith('Error: boom\n');

    watchers.get('template.templ')?.emit();
    signalHandlers.SIGTERM?.();
    watchers.get('data.json')?.emit();
    await vi.advanceTimersByTimeAsync(500);
    await runPromise;

    expect(deps.render).toHaveBeenCalledTimes(1);
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

    try {
      expect(defaultWatchModeDependencies.fileExists(watchedPath)).toBe(true);
      await expect(
        defaultWatchModeDependencies.render('template.templ', watchedPath)
      ).resolves.toBe('');

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

      const previousExitCode = process.exitCode;
      defaultWatchModeDependencies.setProcessExitCode(9);
      expect(process.exitCode).toBe(9);
      process.exitCode = previousExitCode;
    } finally {
      onSpy.mockRestore();
      offSpy.mockRestore();
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
