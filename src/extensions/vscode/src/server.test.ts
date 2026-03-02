import { describe, expect, it, vi } from 'vitest';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const listen = vi.fn();

const initialize = vi.fn(() => ({}));
const initialized = vi.fn();
const shutdown = vi.fn();

const createTempljsLanguagePlugin = vi.fn(() => ({ name: 'templjs-plugin' }));

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    listen,
  })),
  createServer: vi.fn(() => ({
    initialize,
    initialized,
    shutdown,
  })),
  createSimpleProjectProvider: { name: 'simple-project-provider' },
}));

vi.mock('@templjs/volar', () => ({
  createTempljsLanguagePlugin,
}));

describe('language-server-bootstrap', () => {
  it('wires connection lifecycle handlers and starts listening', async () => {
    await import('./server');

    expect(onInitialize).toHaveBeenCalledWith(expect.any(Function));
    expect(onInitialized).toHaveBeenCalledWith(initialized);
    expect(onShutdown).toHaveBeenCalledWith(shutdown);
    expect(listen).toHaveBeenCalled();
  });

  it('registers templjs language plugin provider', async () => {
    await import('./server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    initializeHandler({});

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        { getServicePlugins: () => unknown[]; getLanguagePlugins: () => unknown[] },
      ]
    >;
    const serverOptions = initializeCalls[0][2];

    expect(serverOptions.getServicePlugins()).toEqual([]);
    serverOptions.getLanguagePlugins();
    expect(createTempljsLanguagePlugin).toHaveBeenCalled();
  });
});
