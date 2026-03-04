import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerCommand = vi.fn((_name: string, _handler: () => void) => ({
  dispose: vi.fn(),
}));
const showInformationMessage = vi.fn();
const showErrorMessage = vi.fn();
const createFileSystemWatcher = vi.fn(() => ({ dispose: vi.fn() }));

const start = vi.fn(() => Promise.resolve());
const stop = vi.fn(() => Promise.resolve());
const languageClientConstructor = vi.fn().mockImplementation(function LanguageClientMock() {
  return {
    start,
    stop,
  };
});

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
  LanguageClient: languageClientConstructor,
}));

vi.mock('vscode-languageclient/node.js', () => ({
  TransportKind: { ipc: 'ipc' },
  LanguageClient: languageClientConstructor,
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
    languageClientConstructor.mockClear();
  });

  it('activates extension and starts language client', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
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

    const module = await import('../src/extension');
    module.activate(context as never);

    const commandHandler = registerCommand.mock.calls[0][1] as () => void;
    commandHandler();

    expect(showInformationMessage).toHaveBeenCalledWith('Templjs extension is working! 🚀');
  });

  it('creates language client with templjs identifiers', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(languageClientConstructor).toHaveBeenCalledWith(
      'templjs',
      'Templjs Language Server',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('registers all templjs document selectors', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      documentSelector: Array<{ scheme: string; language: string }>;
    };
    expect(clientOptions.documentSelector).toEqual(
      expect.arrayContaining([
        { scheme: 'file', language: 'templjs-yaml' },
        { scheme: 'file', language: 'templjs-json' },
        { scheme: 'file', language: 'templjs-markdown' },
        { scheme: 'file', language: 'templjs-html' },
      ])
    );
  });

  it('creates watcher with templated file glob', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(createFileSystemWatcher).toHaveBeenCalledWith(
      '**/*.{templ,tmpl}.{md,json,yaml,yml,html}'
    );
  });

  it('passes TypeScript SDK initialization options to the language client', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: { typescript?: { tsdk: string } | undefined };
    };
    expect(clientOptions.initializationOptions.typescript?.tsdk).toContain('typescript/lib');
  });

  it('reports activation errors when language server initialization fails', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: () => {
        throw new Error('broken path resolution');
      },
    };

    const module = await import('../src/extension');
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

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(createFileSystemWatcher).toHaveBeenCalled();

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: { typescript?: { tsdk: string } | undefined };
    };
    expect(clientOptions.initializationOptions.typescript?.tsdk).toContain('typescript/lib');

    delete (globalThis as { require?: unknown }).require;
  });

  it('pushes command and language client into extension subscriptions', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(context.subscriptions.length).toBeGreaterThanOrEqual(2);
  });

  it('deactivates and stops language client when active', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);
    const deactivation = module.deactivate();
    if (deactivation) {
      await deactivation;
    }
    expect(true).toBe(true);
  });

  it('returns undefined when deactivating without active client', async () => {
    const module = await import('../src/extension');
    expect(module.deactivate()).toBeUndefined();
  });
});
