import { describe, expect, it, vi } from 'vitest';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const onNotification = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
const onDidChangeWatchedFiles = vi.fn();
const onCompletion = vi.fn();
const onHover = vi.fn();
const onDefinition = vi.fn();
const sendDiagnostics = vi.fn();
const listen = vi.fn();

const initialize = vi.fn(async () => ({ capabilities: {} }));
const initialized = vi.fn();
const shutdown = vi.fn();
const getLanguageService = vi.fn();
const createSimpleProject = vi.fn((plugins: unknown) => ({ plugins }));

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    onNotification,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onDidChangeWatchedFiles,
    onCompletion,
    onHover,
    onDefinition,
    sendDiagnostics,
    console: {
      log: vi.fn(),
      warn: vi.fn(),
    },
    listen,
  })),
  createServer: vi.fn(() => ({
    initialize,
    initialized,
    shutdown,
    project: {
      getLanguageService,
    },
  })),
  createSimpleProject,
}));

describe('language-server formatting fallback', () => {
  it('initializes successfully when the connection has no document formatting handler', async () => {
    const mod = await import('../src/index.ts');
    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
      capabilities: { documentFormattingProvider?: boolean };
    }>;
    const result = await initializeHandler({ rootUri: 'file:///workspace' });

    expect(result.capabilities.documentFormattingProvider).toBe(false);
    expect(listen).not.toHaveBeenCalled();

    mod.startTempljsLanguageServer();
    expect(listen).toHaveBeenCalledTimes(1);
  });
});
