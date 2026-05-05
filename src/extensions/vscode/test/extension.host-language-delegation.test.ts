import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerCommand = vi.fn(() => ({ dispose: vi.fn() }));
const outputChannel = {
  appendLine: vi.fn(),
  append: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
  name: 'templjs',
};
const createOutputChannel = vi.fn(() => outputChannel);
const createFileSystemWatcher = vi.fn(() => ({
  onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
  onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
}));
const onDidChangeActiveTextEditor = vi.fn(() => ({ dispose: vi.fn() }));
const registerTextDocumentContentProvider = vi.fn(() => ({ dispose: vi.fn() }));
const onDidOpenTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidCloseTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeConfiguration = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeDiagnostics = vi.fn(() => ({ dispose: vi.fn() }));
const createDiagnosticCollection = vi.fn(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  dispose: vi.fn(),
  clear: vi.fn(),
}));
const getDiagnostics = vi.fn(() => []);
const openTextDocument = vi.fn(() => Promise.resolve({}));
const getConfiguration = vi.fn(() => ({
  get: vi.fn((_key: string, fallback?: unknown) => fallback),
}));

const providerUpdate = vi.fn(() => ({ scheme: 'templjs-virtual', path: '/doc.md' }));
const providerRemove = vi.fn();

const start = vi.fn(() => Promise.resolve());
const stop = vi.fn(() => Promise.resolve());
const sendNotification = vi.fn(() => Promise.resolve());
const languageClientConstructor = vi.fn().mockImplementation(function LanguageClientMock() {
  return {
    start,
    stop,
    sendNotification,
  };
});

vi.mock('vscode', () => ({
  commands: { registerCommand },
  window: {
    createOutputChannel,
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor,
  },
  workspace: {
    createFileSystemWatcher,
    getConfiguration,
    registerTextDocumentContentProvider,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onDidCloseTextDocument,
    onDidChangeConfiguration,
    textDocuments: [],
    openTextDocument,
  },
  languages: {
    createDiagnosticCollection,
    onDidChangeDiagnostics,
    getDiagnostics,
  },
  ViewColumn: { Beside: 2 },
}));

vi.mock('vscode-languageclient/node', () => ({
  LanguageClient: languageClientConstructor,
  TransportKind: { ipc: 1 },
}));

vi.mock('../src/virtual-document-provider', () => ({
  VIRTUAL_SCHEME: 'templjs-virtual',
  TempljsVirtualDocumentProvider: class {
    update = providerUpdate;
    remove = providerRemove;
    dispose = vi.fn();
  },
}));

describe('extension host language delegation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers the virtual document provider and syncs templjs document events', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };
    const templDoc = {
      uri: { scheme: 'file', fsPath: '/workspace/boot.md.templ' },
      languageId: 'plaintext',
      getText: () => 'boot text',
    };
    const vscode = await import('vscode');
    vscode.workspace.textDocuments.push(templDoc as never);

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(registerTextDocumentContentProvider).toHaveBeenCalledWith(
      'templjs-virtual',
      expect.any(Object)
    );
    expect(onDidOpenTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(onDidChangeTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(onDidCloseTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(providerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/workspace/boot.md.templ' }),
      'boot text'
    );

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (document: {
      uri: { scheme: string; fsPath: string };
      languageId: string;
      getText: () => string;
    }) => void;
    const changeHandler = onDidChangeTextDocument.mock.calls[0][0] as (event: {
      document: {
        uri: { scheme: string; fsPath: string };
        languageId: string;
        getText: () => string;
      };
    }) => void;
    const closeHandler = onDidCloseTextDocument.mock.calls[0][0] as (document: {
      uri: { scheme: string; fsPath: string };
      languageId: string;
    }) => void;

    openHandler({
      uri: { scheme: 'file', fsPath: '/workspace/page.md.templ' },
      languageId: 'plaintext',
      getText: () => 'open text',
    });
    changeHandler({
      document: {
        uri: { scheme: 'file', fsPath: '/workspace/page.md.templ' },
        languageId: 'plaintext',
        getText: () => 'changed text',
      },
    });
    closeHandler({
      uri: { scheme: 'file', fsPath: '/workspace/page.md.templ' },
      languageId: 'plaintext',
    });

    expect(providerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/workspace/page.md.templ' }),
      'open text'
    );
    expect(providerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/workspace/page.md.templ' }),
      'changed text'
    );
    expect(providerRemove).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/workspace/page.md.templ' })
    );
  });

  it('restarts the language client when formatter-related configuration changes', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const configHandler = onDidChangeConfiguration.mock.calls[0][0] as (event: {
      affectsConfiguration: (section: string) => boolean;
    }) => void;

    configHandler({
      affectsConfiguration: (section: string) =>
        section === '[markdown]' ||
        section === '[json]' ||
        section === 'templjs.prettierHostLanguages',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(stop).toHaveBeenCalled();
    expect(languageClientConstructor).toHaveBeenCalledTimes(2);
  });

  it('ignores concurrent restart requests and logs restart failures', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };
    let resolveStop: (() => void) | undefined;
    stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        })
    );

    const module = await import('../src/extension');
    module.activate(context as never);

    const configHandler = onDidChangeConfiguration.mock.calls[0][0] as (event: {
      affectsConfiguration: (section: string) => boolean;
    }) => void;
    const event = {
      affectsConfiguration: (section: string) =>
        section === '[markdown]' || section === 'templjs.prettierHostLanguages',
    };

    configHandler(event);
    configHandler(event);
    await Promise.resolve();

    expect(stop).toHaveBeenCalledTimes(1);
    resolveStop?.();
    await Promise.resolve();

    stop.mockRejectedValueOnce(new Error('restart failed'));
    configHandler(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restart language client: Error: restart failed')
    );
  });
});
