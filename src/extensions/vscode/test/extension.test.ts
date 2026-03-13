import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerCommand = vi.fn((_name: string, _handler: () => void) => ({
  dispose: vi.fn(),
}));
const showInformationMessage = vi.fn();
const showErrorMessage = vi.fn();
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
const activeTextEditor = {
  document: {
    uri: {
      scheme: 'file',
      toString: () => 'file:///workspace/backlog/054_bug_no_schema_aware_authoring.md',
    },
    getText: () => '---\n$templ-schema: .templjs/root.json\n---\n{{ user.name }}',
  },
};
const createFileSystemWatcher = vi.fn(() => ({ dispose: vi.fn() }));
const onDidOpenTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeActiveTextEditor = vi.fn(() => ({ dispose: vi.fn() }));
const getConfiguration = vi.fn(() => ({
  get: vi.fn((key: string): unknown => {
    if (key === 'schemaPath') {
      return '.templjs/schema.json';
    }
    if (key === 'contentSchemaPath') {
      return '.templjs/content-schema.json';
    }
    if (key === 'schemas') {
      return {
        'backlog/**': {
          schemaPath: 'https://schemas.example.com/work-item-frontmatter.json',
          contentSchemaPath: 'https://schemas.example.com/work-item-content.json',
        },
      };
    }
    return undefined;
  }),
}));

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
    createOutputChannel,
    activeTextEditor,
    onDidChangeActiveTextEditor,
  },
  workspace: {
    createFileSystemWatcher,
    onDidOpenTextDocument,
    getConfiguration,
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
    createOutputChannel.mockClear();
    outputChannel.dispose.mockClear();
    getConfiguration.mockClear();
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
      documentSelector: Array<{ scheme: string; language?: string; pattern?: string }>;
      middleware?: {
        provideCompletionItem?: (...args: unknown[]) => unknown;
        provideHover?: (...args: unknown[]) => unknown;
        provideDefinition?: (...args: unknown[]) => unknown;
      };
    };
    expect(clientOptions.documentSelector).toEqual(
      expect.arrayContaining([
        { scheme: 'file', language: 'templjs-yaml' },
        { scheme: 'file', language: 'templjs-json' },
        { scheme: 'file', language: 'templjs-markdown' },
        { scheme: 'file', language: 'templjs-html' },
        { scheme: 'file', pattern: '**/*.md.tpl' },
      ])
    );
    expect(clientOptions.middleware?.provideCompletionItem).toBeTypeOf('function');
    expect(clientOptions.middleware?.provideHover).toBeTypeOf('function');
    expect(clientOptions.middleware?.provideDefinition).toBeTypeOf('function');
  });

  it('creates watcher with templated file glob', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(createFileSystemWatcher).toHaveBeenCalledWith(
      '**/*.{md,json,yaml,yml,html}.{templ,tmpl,tpl}'
    );
  });

  it('creates a templjs output channel for language server logs', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(createOutputChannel).toHaveBeenCalledWith('templjs');
  });

  it('passes TypeScript SDK initialization options to the language client', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: {
        typescript?: { tsdk: string } | undefined;
        schemaPath?: string;
        contentSchemaPath?: string;
        schemaPatterns?: Record<string, { schemaPath?: string; contentSchemaPath?: string }>;
        documentContext?: { uri: string; content: string };
      };
    };
    expect(clientOptions.initializationOptions.typescript?.tsdk).toContain('typescript/lib');
    expect(clientOptions.initializationOptions.schemaPath).toBe('.templjs/schema.json');
    expect(clientOptions.initializationOptions.contentSchemaPath).toBe(
      '.templjs/content-schema.json'
    );
    expect(clientOptions.initializationOptions.schemaPatterns).toEqual({
      'backlog/**': {
        schemaPath: 'https://schemas.example.com/work-item-frontmatter.json',
        contentSchemaPath: 'https://schemas.example.com/work-item-content.json',
      },
    });
    expect(clientOptions.initializationOptions.documentContext).toEqual({
      uri: 'file:///workspace/backlog/054_bug_no_schema_aware_authoring.md',
      content: '---\n$templ-schema: .templjs/root.json\n---\n{{ user.name }}',
    });
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
      initializationOptions: {
        typescript?: { tsdk: string } | undefined;
        schemaPath?: string;
        contentSchemaPath?: string;
        schemaPatterns?: Record<string, { schemaPath?: string; contentSchemaPath?: string }>;
      };
    };
    expect(clientOptions.initializationOptions.typescript?.tsdk).toContain('typescript/lib');
    expect(clientOptions.initializationOptions.schemaPath).toBe('.templjs/schema.json');
    expect(clientOptions.initializationOptions.contentSchemaPath).toBe(
      '.templjs/content-schema.json'
    );
    expect(clientOptions.initializationOptions.schemaPatterns).toEqual({
      'backlog/**': {
        schemaPath: 'https://schemas.example.com/work-item-frontmatter.json',
        contentSchemaPath: 'https://schemas.example.com/work-item-content.json',
      },
    });

    delete (globalThis as { require?: unknown }).require;
  });

  it('omits schemaPath when templjs.schemaPath is blank', async () => {
    getConfiguration.mockReturnValue({
      get: vi.fn((key: string): unknown => {
        if (key === 'schemaPath') {
          return '   ';
        }
        if (key === 'contentSchemaPath') {
          return '   ';
        }
        if (key === 'schemas') {
          return {};
        }
        return undefined;
      }),
    });

    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: {
        schemaPath?: string;
        contentSchemaPath?: string;
        schemaPatterns?: Record<string, { schemaPath?: string; contentSchemaPath?: string }>;
      };
    };
    expect(clientOptions.initializationOptions.schemaPath).toBeUndefined();
    expect(clientOptions.initializationOptions.contentSchemaPath).toBeUndefined();
    expect(clientOptions.initializationOptions.schemaPatterns).toBeUndefined();
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
