import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Writable } from 'stream';
import { registerSignalHandlers, type SignalHandlerOptions } from '../src/signal-handler.js';
import { formatErrorContext, formatError, provideErrorSuggestion } from '../src/error-formatter.js';
import { detectTTY, getTimeoutForMode } from '../src/tty-detection.js';
import {
  shouldStream,
  LARGE_FILE_THRESHOLD,
  streamToString,
  readFileStream,
  createFileWriteStream,
} from '../src/streaming-io.js';

describe('signal-handler', () => {
  const initialSignalListeners = {
    SIGINT: [...process.listeners('SIGINT')],
    SIGTERM: [...process.listeners('SIGTERM')],
    SIGPIPE: [...process.listeners('SIGPIPE')],
  };

  let baselineSigIntListeners = 0;

  beforeEach(() => {
    baselineSigIntListeners = process.listeners('SIGINT').length;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGPIPE'] as const) {
      for (const listener of process.listeners(signal)) {
        process.removeListener(signal, listener as (...args: any[]) => void);
      }
      for (const listener of initialSignalListeners[signal]) {
        process.on(signal, listener as (...args: any[]) => void);
      }
    }
    vi.clearAllMocks();
  });

  it('can leak listeners when cleanup is not called within a test', () => {
    registerSignalHandlers({});
    expect(process.listeners('SIGINT').length).toBeGreaterThan(baselineSigIntListeners);
  });

  it('starts next test without leaked SIGINT listeners from prior test', () => {
    expect(process.listeners('SIGINT').length).toBe(initialSignalListeners.SIGINT.length);
  });

  it('registers SIGINT handler that exits with code 130', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const onSigInt = vi.fn();
    const options: SignalHandlerOptions = { onSigInt };

    const cleanup = registerSignalHandlers(options);
    const handlers = process.listeners('SIGINT');
    expect(handlers.length).toBeGreaterThan(0);

    // Simulate SIGINT
    process.emit('SIGINT');

    // Give async handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(exitSpy).toHaveBeenCalledWith(130);
    cleanup();
    exitSpy.mockRestore();
  });

  it('registers SIGTERM handler that exits with code 143', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const onSigTerm = vi.fn();
    const options: SignalHandlerOptions = { onSigTerm };

    const cleanup = registerSignalHandlers(options);

    // Simulate SIGTERM
    process.emit('SIGTERM');

    // Give async handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(exitSpy).toHaveBeenCalledWith(143);
    cleanup();
    exitSpy.mockRestore();
  });

  it('registers SIGPIPE handler that exits with code 141', async () => {
    if (process.platform === 'win32') {
      return;
    }

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const options: SignalHandlerOptions = { onSigPipe: () => {} };

    const cleanup = registerSignalHandlers(options);

    // Simulate SIGPIPE
    process.emit('SIGPIPE');

    // Give async handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(exitSpy).toHaveBeenCalledWith(141);
    cleanup();
    exitSpy.mockRestore();
  });

  it('registers and cleans up SIGPIPE listeners when platform is non-Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'linux',
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const options: SignalHandlerOptions = { onSigPipe: () => {} };

    try {
      const cleanup = registerSignalHandlers(options);

      const sigpipeListenerCount = process.listeners('SIGPIPE').length;
      expect(sigpipeListenerCount).toBeGreaterThan(0);

      process.emit('SIGPIPE');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(exitSpy).toHaveBeenCalledWith(141);

      cleanup();
      expect(process.listeners('SIGPIPE').length).toBe(sigpipeListenerCount - 1);
    } finally {
      Object.defineProperty(process, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      exitSpy.mockRestore();
    }
  });

  it('calls handler functions before exiting', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const onSigInt = vi.fn();
    const options: SignalHandlerOptions = { onSigInt };

    const cleanup = registerSignalHandlers(options);
    process.emit('SIGINT');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onSigInt).toHaveBeenCalled();
    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('handles async handler functions', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    let handlerExecuted = false;

    const onSigInt = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      handlerExecuted = true;
    });

    const cleanup = registerSignalHandlers({ onSigInt, cleanupTimeoutMs: 5000 });
    process.emit('SIGINT');

    await vi.waitFor(() => {
      expect(handlerExecuted).toBe(true);
      expect(exitSpy).toHaveBeenCalledWith(130);
    });

    cleanup();
    exitSpy.mockRestore();
  });

  it('handles handler errors gracefully', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const onSigInt = vi.fn(() => {
      throw new Error('Handler error');
    });

    const cleanup = registerSignalHandlers({ onSigInt });
    process.emit('SIGINT');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/Error during SIGINT cleanup/));
    expect(exitSpy).toHaveBeenCalledWith(130);
    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('cleanup function removes signal listeners', () => {
    const beforeListeners = new Set(process.listeners('SIGINT'));

    const cleanup = registerSignalHandlers({});
    const afterRegisterListeners = process.listeners('SIGINT');
    const newListeners = afterRegisterListeners.filter(
      (listener) => !beforeListeners.has(listener)
    );

    cleanup();
    const afterCleanupListeners = process.listeners('SIGINT');

    for (const listener of newListeners) {
      expect(afterCleanupListeners).not.toContain(listener);
    }
  });

  it('cleanup function is idempotent', () => {
    const cleanup = registerSignalHandlers({});

    // Calling cleanup twice should not throw
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });

  it('SIGPIPE errors are silent (no stderr output)', async () => {
    if (process.platform === 'win32') {
      return;
    }

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const onSigPipe = vi.fn(() => {
      throw new Error('Handler error');
    });

    const cleanup = registerSignalHandlers({ onSigPipe });
    process.emit('SIGPIPE');

    await new Promise((resolve) => setTimeout(resolve, 10));

    // SIGPIPE errors should NOT write to stderr
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(141);
    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });
  it('ignores multiple signals after first one is handling', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const onSigInt = vi.fn();

    const cleanup = registerSignalHandlers({ onSigInt, cleanupTimeoutMs: 5000 });

    // Emit multiple signals in rapid succession
    process.emit('SIGINT');
    process.emit('SIGINT');
    process.emit('SIGINT');

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Only one exit should occur
    expect(exitSpy).toHaveBeenCalledTimes(1);
    cleanup();
    exitSpy.mockRestore();
  });

  it('times out if handler hangs indefinitely', { timeout: 10000 }, async () => {
    vi.useFakeTimers();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Create a handler that never resolves (infinite hang)
    const onSigInt = vi.fn((): Promise<void> => {
      return new Promise(() => {
        // Never resolves - simulates hung handler
      });
    });

    const cleanup = registerSignalHandlers({ onSigInt });
    process.emit('SIGINT');

    // Advance timers to trigger the timeout
    await vi.advanceTimersByTimeAsync(5100);

    // Handler should have been called
    expect(onSigInt).toHaveBeenCalled();
    // Exit should have been called after timeout
    expect(exitSpy).toHaveBeenCalledWith(130);

    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.useRealTimers();
  });

  it('defers forced exit when output streams still have pending writes', async () => {
    vi.useFakeTimers();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const stdoutLengthDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'writableLength'
    );
    const stderrLengthDescriptor = Object.getOwnPropertyDescriptor(
      process.stderr,
      'writableLength'
    );

    try {
      Object.defineProperty(process.stdout, 'writableLength', {
        configurable: true,
        get: () => 1,
      });
      Object.defineProperty(process.stderr, 'writableLength', {
        configurable: true,
        get: () => 0,
      });

      const cleanup = registerSignalHandlers({ cleanupTimeoutMs: 25 });
      process.emit('SIGINT');

      await vi.advanceTimersByTimeAsync(24);
      expect(exitSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(exitSpy).toHaveBeenCalledWith(130);

      cleanup();
    } finally {
      exitSpy.mockRestore();
      vi.useRealTimers();
      if (stdoutLengthDescriptor) {
        Object.defineProperty(process.stdout, 'writableLength', stdoutLengthDescriptor);
      } else {
        delete (process.stdout as { writableLength?: number }).writableLength;
      }

      if (stderrLengthDescriptor) {
        Object.defineProperty(process.stderr, 'writableLength', stderrLengthDescriptor);
      } else {
        delete (process.stderr as { writableLength?: number }).writableLength;
      }
    }
  });

  it('handles non-Error exceptions thrown by handler', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Throw string instead of Error object
    const onSigInt = vi.fn(() => {
      throw 'String exception, not an Error object';
    });

    const cleanup = registerSignalHandlers({ onSigInt });
    process.emit('SIGINT');

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should catch the string exception and write to stderr using String() fallback
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Error during SIGINT cleanup.*String exception/)
    );
    expect(exitSpy).toHaveBeenCalledWith(130);
    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

describe('error-formatter', () => {
  it('formats error with context lines', () => {
    const source = `line 1
line 2
line 3
line 4
line 5
line 6`;

    const result = formatErrorContext(source, 4, 5, { contextLines: 1 });

    expect(result.message).toContain('line 4');
    expect(result.context).toContain('line 3');
    expect(result.context).toContain('line 4');
    expect(result.context).toContain('line 5');
  });

  it('shows line numbers in context', () => {
    const source = `line 1
line 2
line 3`;

    const result = formatErrorContext(source, 2, 1, { showLineNumbers: true });

    expect(result.context).toMatch(/^\s+1 \|/m);
    expect(result.context).toMatch(/^\s+2 \|/m);
    expect(result.context).toMatch(/^\s+3 \|/m);
  });

  it('highlights error column with marker', () => {
    const source = `line 1
line 2
line 3`;

    const result = formatErrorContext(source, 2, 3, {
      highlightColumn: true,
      showLineNumbers: true,
    });

    // Should have line number prefix (6 chars: "  2 | ") + column position
    expect(result.context).toContain('^');
  });

  it('handles errors at boundaries correctly', () => {
    const source = `line 1
line 2
line 3`;

    const result = formatErrorContext(source, 1, 1);
    expect(result.message).toContain('line 1');

    const result2 = formatErrorContext(source, 3, 1);
    expect(result2.message).toContain('line 3');
  });

  it('handles out-of-bounds line numbers gracefully', () => {
    const source = `line 1
line 2`;

    const result = formatErrorContext(source, 10, 1);
    expect(result.message).toContain('10');
    expect(result.context).toBeUndefined();
  });

  it('formats full error with context', () => {
    const source = `Users:
{% for user in users %}
Name: {{ user.name }}
Email: {{ user.email }}
{% endfor %}`;

    const result = formatError(source, source, 3, 8);

    expect(result).toContain('3 |'); // Line number prefix format
    expect(result).toContain('Name:');
  });

  it('formats error from Error object', () => {
    const error = new Error('Test error');
    const result = formatError(error);

    expect(result).toContain('Test error');
  });

  it('provides helpful suggestions for undefined variables', () => {
    const suggestion = provideErrorSuggestion('Error: undefined variable not found');
    expect(suggestion).toBeDefined();
    expect(suggestion).toMatch(/variable|data/i);
  });

  it('provides helpful suggestions for JSON errors', () => {
    const suggestion = provideErrorSuggestion('Failed to parse JSON');
    expect(suggestion).toBeDefined();
    expect(suggestion).toMatch(/JSON/i);
  });

  it('provides helpful suggestions for file not found', () => {
    const suggestion = provideErrorSuggestion('File not found: ENOENT');
    expect(suggestion).toBeDefined();
    expect(suggestion).toMatch(/file|path/i);
  });

  it('provides helpful suggestions for permission errors', () => {
    const suggestion = provideErrorSuggestion('Permission denied EACCES');
    expect(suggestion).toBeDefined();
    expect(suggestion).toMatch(/permission|access/i);
  });

  it('returns undefined for unknown errors', () => {
    const suggestion = provideErrorSuggestion('Some random error');
    expect(suggestion).toBeUndefined();
  });
});

describe('tty-detection', () => {
  it('detects TTY status correctly', () => {
    const result = detectTTY();

    expect(result).toHaveProperty('stdinIsTTY');
    expect(result).toHaveProperty('stdoutIsTTY');
    expect(result).toHaveProperty('stderrIsTTY');
    expect(result).toHaveProperty('isInteractive');
  });

  it('marks as interactive when both stdin and stdout are TTYs', () => {
    // This test depends on actual environment, so just verify the logic
    const result = detectTTY();
    const expectedInteractive = result.stdinIsTTY && result.stdoutIsTTY;
    expect(result.isInteractive).toBe(expectedInteractive);
  });

  it('returns appropriate timeout for interactive mode', () => {
    const interactiveTimeout = getTimeoutForMode(true);
    expect(interactiveTimeout).toBe(30000); // Default interactive timeout

    const pipeTimeout = getTimeoutForMode(false);
    expect(pipeTimeout).toBe(5000); // Default pipe timeout
  });

  it('uses custom timeout values', () => {
    const customInteractive = getTimeoutForMode(true, 60000, 1000);
    expect(customInteractive).toBe(60000);

    const customPipe = getTimeoutForMode(false, 60000, 1000);
    expect(customPipe).toBe(1000);
  });

  it('interactive timeout is greater than pipe timeout', () => {
    const interactive = getTimeoutForMode(true);
    const pipe = getTimeoutForMode(false);
    expect(interactive).toBeGreaterThan(pipe);
  });
});

describe('streaming-io', () => {
  it('identifies large files correctly', () => {
    const shouldStreamSmall = shouldStream(5 * 1024 * 1024); // 5MB
    expect(shouldStreamSmall).toBe(false);

    const shouldStreamLarge = shouldStream(15 * 1024 * 1024); // 15MB
    expect(shouldStreamLarge).toBe(true);
  });

  it('uses correct threshold for streaming', () => {
    const threshold = LARGE_FILE_THRESHOLD;
    expect(threshold).toBe(10 * 1024 * 1024);
  });

  it('respects custom threshold', () => {
    const customThreshold = 5 * 1024 * 1024;
    const shouldStream5MB = shouldStream(6 * 1024 * 1024, customThreshold);
    expect(shouldStream5MB).toBe(true);

    const shouldNotStream2MB = shouldStream(2 * 1024 * 1024, customThreshold);
    expect(shouldNotStream2MB).toBe(false);
  });

  it('converts stream to string correctly', async () => {
    async function* mockStream() {
      yield 'hello ';
      yield 'world';
    }

    const result = await streamToString(mockStream());
    expect(result).toBe('hello world');
  });

  it('handles empty stream', async () => {
    async function* emptyStream() {
      // yield nothing
    }

    const result = await streamToString(emptyStream());
    expect(result).toBe('');
  });

  it('handles stream with multiple chunks', async () => {
    async function* multiChunkStream() {
      yield 'chunk1';
      yield 'chunk2';
      yield 'chunk3';
    }

    const result = await streamToString(multiChunkStream());
    expect(result).toBe('chunk1chunk2chunk3');
  });
});

describe('integration tests', () => {
  it('signal handler + error formatter work together', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const onSigInt = () => {
      const errorMsg = formatError('Template error', 'template code', 1, 5);
      process.stderr.write(errorMsg);
    };

    const cleanup = registerSignalHandlers({ onSigInt });
    process.emit('SIGINT');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(stderrSpy).toHaveBeenCalled();
    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('TTY detection + timeout selection work together', () => {
    const ttyInfo = detectTTY();
    const timeout = getTimeoutForMode(ttyInfo.isInteractive);

    expect(typeof timeout).toBe('number');
    expect(timeout).toBeGreaterThan(0);
  });

  it('streaming decision based on file size', () => {
    const decision1 = shouldStream(5 * 1024 * 1024); // 5MB - should not stream
    const decision2 = shouldStream(20 * 1024 * 1024); // 20MB - should stream

    expect(decision1).toBe(false);
    expect(decision2).toBe(true);
  });
});

describe('Streaming I/O and Large File Support', () => {
  let tmpDir: string;
  const memoryAssertionsEnabled = process.env.TEMPLJS_ENABLE_MEMORY_ASSERTS === '1';
  const canRunStableMemoryAssertions = memoryAssertionsEnabled && typeof global.gc === 'function';

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'templjs-stream-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('handles 10MB+ files without loading into memory', async () => {
    const largePath = path.join(tmpDir, 'large-10mb.txt');
    const tenMB = 10 * 1024 * 1024;

    // Create 10MB file
    const buffer = Buffer.alloc(tenMB, 'x');
    await fs.promises.writeFile(largePath, buffer);

    // Verify file was created
    const stats = await fs.promises.stat(largePath);
    expect(stats.size).toBeGreaterThanOrEqual(tenMB);

    let heapBefore = 0;
    if (canRunStableMemoryAssertions) {
      global.gc?.();
      heapBefore = process.memoryUsage().heapUsed;
    }

    // Stream the file
    let totalBytesRead = 0;
    for await (const chunk of readFileStream(largePath, tenMB)) {
      totalBytesRead += Buffer.byteLength(chunk);
    }

    if (canRunStableMemoryAssertions) {
      global.gc?.();
      const heapAfter = process.memoryUsage().heapUsed;
      const heapDelta = heapAfter - heapBefore;
      expect(heapDelta).toBeLessThan(5 * 1024 * 1024);
    }
    expect(totalBytesRead).toBeGreaterThanOrEqual(tenMB);
  });

  it('handles SIGPIPE when output stream is closed prematurely', async () => {
    if (process.platform === 'win32') {
      return;
    }

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const cleanup = registerSignalHandlers({});

    // Simulate SIGPIPE scenario (broken pipe)
    process.emit('SIGPIPE');

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should exit silently with code 141
    expect(exitSpy).toHaveBeenCalledWith(141);

    cleanup();
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('respects backpressure during streaming writes', async () => {
    let writeCallCount = 0;
    let backpressureApplied = false;

    // Create slow writable stream that applies backpressure
    const slowStream = new Writable({
      highWaterMark: 1024, // Small buffer to trigger backpressure
      write(chunk: Buffer | string, encoding: string, callback: () => void) {
        writeCallCount++;

        // Check if backpressure was applied
        if (!this.writableHighWaterMark || this.writableLength > this.writableHighWaterMark) {
          backpressureApplied = true;
        }

        // Simulate slow write with delay
        setTimeout(callback, 5);
      },
    });

    // Write enough data to trigger backpressure while keeping only one drain listener at a time.
    for (let i = 0; i < 100; i++) {
      await new Promise<void>((resolve) => {
        const canContinue = slowStream.write('x'.repeat(100));
        if (!canContinue) {
          backpressureApplied = true;
          slowStream.once('drain', resolve);
        } else {
          resolve();
        }
      });
    }

    slowStream.end();

    // Should have multiple write calls (chunked writing)
    expect(writeCallCount).toBeGreaterThan(10);

    // Backpressure should have been applied
    expect(backpressureApplied).toBe(true);
  });

  it('tracks progress during large file streaming', async () => {
    const largePath = path.join(tmpDir, 'progress-test.txt');
    const fileSize = 5 * 1024 * 1024; // 5MB

    // Create 5MB file
    await fs.promises.writeFile(largePath, 'x'.repeat(fileSize));

    const progressUpdates: Array<{ bytes: number; total?: number }> = [];

    for await (const _chunk of readFileStream(largePath, fileSize, {
      onProgress: (bytesRead, totalBytes) => {
        progressUpdates.push({ bytes: bytesRead, total: totalBytes });
      },
    })) {
      // Process chunks
    }

    // Should have received progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);

    // Last update should be close to file size
    const lastUpdate = progressUpdates[progressUpdates.length - 1];
    expect(lastUpdate.bytes).toBeGreaterThanOrEqual(fileSize * 0.95); // Within 5%
    expect(lastUpdate.total).toBe(fileSize);
  });

  it('handles streaming writes without memory accumulation', async () => {
    const outputPath = path.join(tmpDir, 'stream-write.txt');
    const writeStream = createFileWriteStream(outputPath);

    let heapBefore = 0;
    if (canRunStableMemoryAssertions) {
      global.gc?.();
      heapBefore = process.memoryUsage().heapUsed;
    }

    // Write 10MB in chunks
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalSize = 10 * 1024 * 1024;
    const numChunks = Math.floor(totalSize / chunkSize);

    for (let i = 0; i < numChunks; i++) {
      await new Promise<void>((resolve, _reject) => {
        const canContinue = writeStream.write('y'.repeat(chunkSize));
        if (!canContinue) {
          writeStream.once('drain', resolve);
        } else {
          setImmediate(resolve); // Allow event loop to process
        }
      });
    }

    await new Promise((resolve) => writeStream.end(resolve));

    if (canRunStableMemoryAssertions) {
      global.gc?.();
      const heapAfter = process.memoryUsage().heapUsed;
      const heapDelta = heapAfter - heapBefore;
      expect(heapDelta).toBeLessThan(5 * 1024 * 1024);
    }

    // Verify file was written
    const stats = await fs.promises.stat(outputPath);
    expect(stats.size).toBeGreaterThanOrEqual(totalSize * 0.95);
  });

  it('uses configurable chunk sizes for streaming', async () => {
    const testPath = path.join(tmpDir, 'chunked.txt');
    await fs.promises.writeFile(testPath, 'a'.repeat(1024 * 100)); // 100KB

    const customChunkSize = 8 * 1024; // 8KB
    const chunks: string[] = [];

    for await (const chunk of readFileStream(testPath, undefined, {
      highWaterMark: customChunkSize,
    })) {
      chunks.push(chunk);
      // First chunk should be approximately the custom size
      if (chunks.length === 1) {
        const chunkBytes = Buffer.byteLength(chunk);
        expect(chunkBytes).toBeGreaterThanOrEqual(customChunkSize * 0.5);
        expect(chunkBytes).toBeLessThanOrEqual(customChunkSize * 2);
      }
    }

    expect(chunks.length).toBeGreaterThan(1); // Should have multiple chunks
  });

  it('handles stream errors gracefully', async () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist.txt');

    await expect(async () => {
      for await (const _chunk of readFileStream(nonExistentPath)) {
        // Should not get here
      }
    }).rejects.toThrow();
  });
});
