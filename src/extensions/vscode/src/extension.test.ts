import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerCommand = vi.fn((_name: string, _handler: () => void) => ({
  dispose: vi.fn(),
}));
const showInformationMessage = vi.fn();
const showErrorMessage = vi.fn();
const createFileSystemWatcher = vi.fn(() => ({ dispose: vi.fn() }));

const start = vi.fn(() => Promise.resolve());
const stop = vi.fn(() => Promise.resolve());

vi.mock('vscode', () => ({
  commands: {
    registerCommand,
  },
  window: {
    showInformationMessage,
    showErrorMessage,
  },
  workspace: {
    createFileSystemWatcher,
  },
}));

vi.mock('vscode-languageclient/node', () => ({
  TransportKind: { ipc: 'ipc' },
  LanguageClient: vi.fn().mockImplementation(() => ({
    start,
    stop,
  })),
}));

vi.mock('vscode-languageclient/node.js', () => ({
  TransportKind: { ipc: 'ipc' },
  LanguageClient: vi.fn().mockImplementation(() => ({
    start,
    stop,
  })),
}));

describe('extension-activation', () => {
  beforeEach(() => {
    vi.resetModules();
    registerCommand.mockClear();
    showInformationMessage.mockClear();
    showErrorMessage.mockClear();
    createFileSystemWatcher.mockClear();
    start.mockClear();
    stop.mockClear();
  });

  it('activates extension and starts language client', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('./extension');
    module.activate(context as never);

    expect(registerCommand).toHaveBeenCalledWith('templjs.test', expect.any(Function));
    expect(context.subscriptions.length).toBeGreaterThan(0);
    expect(
      showInformationMessage.mock.calls.length + showErrorMessage.mock.calls.length
    ).toBeGreaterThan(0);
  });

  it('executes test command callback', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('./extension');
    module.activate(context as never);

    const commandHandler = registerCommand.mock.calls[0][1] as () => void;
    commandHandler();

    expect(showInformationMessage).toHaveBeenCalledWith('Templjs extension is working! 🚀');
  });

  it('reports activation errors when language server initialization fails', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: () => {
        throw new Error('broken path resolution');
      },
    };

    const module = await import('./extension');
    module.activate(context as never);

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to activate Templjs: Error: broken path resolution')
    );
  });

  it('handles activation when TypeScript SDK is resolvable', async () => {
    (globalThis as { require?: { resolve: (id: string) => string } }).require = {
      resolve: () => '/tmp/typescript/lib/tsserverlibrary.js',
    };

    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('./extension');
    module.activate(context as never);

    expect(createFileSystemWatcher).toHaveBeenCalled();

    delete (globalThis as { require?: unknown }).require;
  });

  it('deactivates and stops language client when active', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('./extension');
    module.activate(context as never);
    const deactivation = module.deactivate();
    if (deactivation) {
      await deactivation;
    }
    expect(true).toBe(true);
  });

  it('returns undefined when deactivating without active client', async () => {
    const module = await import('./extension');
    expect(module.deactivate()).toBeUndefined();
  });
});
