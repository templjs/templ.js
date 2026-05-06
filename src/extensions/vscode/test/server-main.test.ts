import { describe, expect, it, vi } from 'vitest';

const startTempljsLanguageServer = vi.fn();

vi.mock('../src/server.js', () => ({
  startTempljsLanguageServer,
}));

describe('server-main entrypoint', () => {
  it('logs startup failures and sets a non-zero exit code', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    process.exitCode = 0;
    startTempljsLanguageServer.mockRejectedValueOnce(new Error('startup failed'));

    await import('../src/server-main');
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(process.exitCode).toBe(1);

    consoleError.mockRestore();
    process.exitCode = originalExitCode;
  });
});
