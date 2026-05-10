import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSync = vi.fn(() => ({ status: 1, stdout: '' }));

const configurationValues: Record<string, unknown> = {
  schemaPath: '.templjs/schema.json',
  contentSchemaPath: '.templjs/content-schema.json',
  schemas: {
    'backlog/**': {
      schemaPath: 'https://schemas.example.com/work-item-frontmatter.json',
      contentSchemaPath: 'https://schemas.example.com/work-item-content.json',
    },
  },
  '[markdown]': {
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
  },
  '[json]': {
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
  },
  '[yaml]': {},
  '[html]': {},
  defaultFormatter: undefined,
  'trace.server': undefined,
};

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
const createFileSystemWatcher = vi.fn(() => ({
  onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
  onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
}));
const onDidChangeActiveTextEditor = vi.fn(() => ({ dispose: vi.fn() }));
const getConfiguration = vi.fn(() => ({
  get: vi.fn((key: string, fallback?: unknown): unknown => configurationValues[key] ?? fallback),
}));

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

// Mocks for host language delegation (virtual document provider)
class MockEventEmitter<T> {
  readonly event = vi.fn();
  fire = vi.fn((_value: T) => {});
  dispose = vi.fn();
}
class MockUri {
  constructor(
    public readonly scheme: string,
    public readonly authority: string,
    public readonly path: string,
    public readonly fsPath: string
  ) {}
  toString() {
    return `${this.scheme}://${this.authority}${this.path}`;
  }
  static from(parts: { scheme: string; authority?: string; path: string }) {
    return new MockUri(parts.scheme, parts.authority ?? '', parts.path, parts.path);
  }
  static file(path: string) {
    return new MockUri('file', '', path, path);
  }
  static parse(str: string) {
    const m = str.match(/^(\w[\w+\-.]*):\/\/([^/]*)(\/.*)$/);
    if (m) return new MockUri(m[1] ?? 'file', m[2] ?? '', m[3] ?? '/', m[3] ?? '/');
    return new MockUri('file', '', str, str);
  }
}
class MockPosition {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}
class MockRange {
  constructor(
    public readonly start: MockPosition,
    public readonly end: MockPosition
  ) {}
}
class MockDiagnostic {
  source?: string;
  code?: string | number | { value: string | number; target: MockUri };
  tags?: number[];
  relatedInformation?: unknown[];
  constructor(
    public readonly range: MockRange,
    public readonly message: string,
    public readonly severity?: number
  ) {}
}
const registerTextDocumentContentProvider = vi.fn(() => ({ dispose: vi.fn() }));
const onDidOpenTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidCloseTextDocument = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeConfiguration = vi.fn(() => ({ dispose: vi.fn() }));
const onDidChangeExtensions = vi.fn(() => ({ dispose: vi.fn() }));
const openTextDocument = vi.fn(() => Promise.resolve({}));
const hostDiagCollection = {
  set: vi.fn(),
  delete: vi.fn(),
  dispose: vi.fn(),
  clear: vi.fn(),
};
const createDiagnosticCollection = vi.fn(() => hostDiagCollection);
const onDidChangeDiagnostics = vi.fn(() => ({ dispose: vi.fn() }));
const getDiagnostics = vi.fn((_uri?: unknown) => []);
const getExtension = vi.fn((_id: string) => undefined);

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
  FileChangeType: {
    Created: 1,
    Changed: 2,
    Deleted: 3,
  },
  EventEmitter: MockEventEmitter,
  Uri: MockUri,
  Position: MockPosition,
  Range: MockRange,
  Diagnostic: MockDiagnostic,
  workspace: {
    createFileSystemWatcher,
    getConfiguration,
    registerTextDocumentContentProvider,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onDidCloseTextDocument,
    onDidChangeConfiguration,
    openTextDocument,
    textDocuments: [],
  },
  extensions: {
    getExtension,
    onDidChange: onDidChangeExtensions,
  },
  languages: {
    createDiagnosticCollection,
    onDidChangeDiagnostics,
    getDiagnostics,
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

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawnSync,
  };
});

describe('extension-activation', () => {
  beforeEach(() => {
    vi.resetModules();
    configurationValues.schemaPath = '.templjs/schema.json';
    configurationValues.contentSchemaPath = '.templjs/content-schema.json';
    configurationValues.schemas = {
      'backlog/**': {
        schemaPath: 'https://schemas.example.com/work-item-frontmatter.json',
        contentSchemaPath: 'https://schemas.example.com/work-item-content.json',
      },
    };
    configurationValues['[markdown]'] = {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    };
    configurationValues['[json]'] = {
      'editor.defaultFormatter': 'esbenp.prettier-vscode',
    };
    configurationValues['[yaml]'] = {};
    configurationValues['[html]'] = {};
    configurationValues.defaultFormatter = undefined;
    configurationValues['trace.server'] = undefined;
    getConfiguration.mockImplementation(() => ({
      get: vi.fn(
        (key: string, fallback?: unknown): unknown => configurationValues[key] ?? fallback
      ),
    }));
    activeTextEditor.document.uri.scheme = 'file';
    activeTextEditor.document.uri.toString = () =>
      'file:///workspace/backlog/054_bug_no_schema_aware_authoring.md';
    activeTextEditor.document.getText = () =>
      '---\n$templ-schema: .templjs/root.json\n---\n{{ user.name }}';
    registerCommand.mockClear();
    showInformationMessage.mockClear();
    showErrorMessage.mockClear();
    outputChannel.appendLine.mockClear();
    outputChannel.append.mockClear();
    createFileSystemWatcher.mockClear();
    onDidChangeActiveTextEditor.mockClear();
    createOutputChannel.mockClear();
    outputChannel.dispose.mockClear();
    getExtension.mockReset();
    getExtension.mockImplementation((_id: string) => undefined);
    onDidChangeExtensions.mockClear();
    getConfiguration.mockClear();
    start.mockClear();
    stop.mockClear();
    sendNotification.mockClear();
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
    expect(onDidChangeExtensions).toHaveBeenCalledWith(expect.any(Function));
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
        { scheme: 'file', pattern: '**/*.tmpl' },
        { scheme: 'file', pattern: '**/*.tpl' },
        { scheme: 'file', pattern: '**/*.md.templ' },
        { scheme: 'file', pattern: '**/*.md.tmpl' },
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
        adapterRuntimes?: Record<string, { state: string; reason: string }>;
        formattingHostLanguages?: string[];
        documentContext?: { uri: string; content: string };
      };
    };
    expect(clientOptions.initializationOptions.typescript?.tsdk).toMatch(/typescript[\\/]lib/);
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
    expect(clientOptions.initializationOptions.formattingHostLanguages).toEqual([
      'markdown',
      'json',
    ]);
    expect(clientOptions.initializationOptions.adapterRuntimes).toMatchObject({
      'templjs-markdown-host': {
        state: 'unavailable',
        reason: 'unavailable-vscode-extension-markdown',
      },
      'templjs-markdownlint-host': {
        state: 'unavailable',
        reason: 'unavailable-binary-markdownlint',
      },
      'templjs-yaml': {
        state: 'unavailable',
        reason: 'unavailable-vscode-extension-yaml',
      },
      'templjs-prettier-host': {
        state: 'unavailable',
        reason: 'unavailable-vscode-extension-prettier',
      },
    });
    expect(clientOptions.initializationOptions.documentContext).toEqual({
      uri: 'file:///workspace/backlog/054_bug_no_schema_aware_authoring.md',
      content: '---\n$templ-schema: .templjs/root.json\n---\n{{ user.name }}',
    });
  });

  it('enables json host adapter runtime when vscode json language features is installed', async () => {
    getExtension.mockImplementation((id: string) =>
      id === 'vscode.json-language-features' ? ({ id } as unknown) : undefined
    );

    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: {
        adapterRuntimes?: Record<string, { state: string; reason: string }>;
      };
    };

    expect(
      clientOptions.initializationOptions.adapterRuntimes?.['templjs-json-host']
    ).toMatchObject({
      state: 'enabled',
      reason: 'resolved-vscode-extension-json',
    });
  });

  it('enables html host adapter runtime when vscode html language features is installed', async () => {
    getExtension.mockImplementation((id: string) =>
      id === 'vscode.html-language-features' ? ({ id } as unknown) : undefined
    );

    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: {
        adapterRuntimes?: Record<string, { state: string; reason: string }>;
      };
    };

    expect(
      clientOptions.initializationOptions.adapterRuntimes?.['templjs-html-host']
    ).toMatchObject({
      state: 'enabled',
      reason: 'resolved-vscode-extension-html',
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
        adapterRuntimes?: Record<string, { state: string; reason: string }>;
        formattingHostLanguages?: string[];
      };
    };
    expect(clientOptions.initializationOptions.typescript?.tsdk).toMatch(/typescript[\\/]lib/);
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
    expect(clientOptions.initializationOptions.formattingHostLanguages).toEqual([
      'markdown',
      'json',
    ]);
    expect(
      clientOptions.initializationOptions.adapterRuntimes?.['templjs-prettier-host']
    ).toMatchObject({
      state: 'unavailable',
      reason: 'unavailable-vscode-extension-prettier',
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
        adapterRuntimes?: Record<string, { state: string; reason: string }>;
        formattingHostLanguages?: string[];
      };
    };
    expect(clientOptions.initializationOptions.schemaPath).toBeUndefined();
    expect(clientOptions.initializationOptions.contentSchemaPath).toBeUndefined();
    expect(clientOptions.initializationOptions.schemaPatterns).toBeUndefined();
    expect(clientOptions.initializationOptions.formattingHostLanguages).toEqual([]);
    expect(
      clientOptions.initializationOptions.adapterRuntimes?.['templjs-prettier-host']
    ).toMatchObject({
      state: 'disabled',
      reason: 'disabled-no-prettier-host-languages',
    });
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

  it('omits active document context for non-file editors', async () => {
    activeTextEditor.document.uri.scheme = 'untitled';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      initializationOptions: { documentContext?: { uri: string; content: string } };
    };
    expect(clientOptions.initializationOptions.documentContext).toBeUndefined();
  });

  it('reports language client startup failures from the unawaited start promise', async () => {
    start.mockImplementationOnce(() => Promise.reject(new Error('startup exploded')));
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);
    await Promise.resolve();
    await Promise.resolve();

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Templjs: Language client failed to start: Error: startup exploded')
    );
    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Language client start failed: Error: startup exploded')
    );
  });

  it('traces middleware activity for completion, hover, and definition in verbose mode', async () => {
    configurationValues['trace.server'] = 'verbose';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      middleware: {
        provideCompletionItem: (...args: unknown[]) => Promise<unknown>;
        provideHover: (...args: unknown[]) => Promise<unknown>;
        provideDefinition: (...args: unknown[]) => Promise<unknown>;
      };
    };
    const document = {
      uri: { toString: () => 'file:///workspace/example.md.tpl' },
      languageId: 'templjs-markdown',
    };
    const position = { line: 3, character: 7 };

    await clientOptions.middleware.provideCompletionItem(document, position, {}, {}, () =>
      Promise.resolve({ items: [{ label: 'Alpha' }, { label: 'Alpha' }, { label: '' }] })
    );
    await clientOptions.middleware.provideHover(document, position, {}, () =>
      Promise.resolve({ contents: ['hover text', { value: 'details' }] })
    );
    await clientOptions.middleware.provideDefinition(document, position, {}, () =>
      Promise.resolve([{ targetUri: { toString: () => 'file:///workspace/schema.json' } }])
    );

    const traceLines = outputChannel.appendLine.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.includes('[templjs-trace]'));

    expect(
      traceLines.some((line) =>
        line.includes('completion requested: file:///workspace/example.md.tpl')
      )
    ).toBe(true);
    expect(traceLines.some((line) => line.includes('completion duplicate labels: alpha×2'))).toBe(
      true
    );
    expect(traceLines.some((line) => line.includes('hover content length=20'))).toBe(true);
    expect(
      traceLines.some((line) =>
        line.includes('definition first target=file:///workspace/schema.json')
      )
    ).toBe(true);
  });

  it('limits tracing to message-level output when configured for messages', async () => {
    configurationValues['trace.server'] = 'messages';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      middleware: {
        provideCompletionItem: (...args: unknown[]) => Promise<unknown>;
      };
    };

    await clientOptions.middleware.provideCompletionItem(
      { uri: { toString: () => 'file:///workspace/example.md.tpl' } },
      { line: 0, character: 0 },
      {},
      {},
      () => Promise.resolve({ items: [{ label: 'Alpha' }, { label: 'Alpha' }] })
    );

    const traceLines = outputChannel.appendLine.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.includes('[templjs-trace]'));
    expect(traceLines.some((line) => line.includes('completion result count=2'))).toBe(true);
    expect(traceLines.some((line) => line.includes('duplicate labels'))).toBe(false);
  });

  it('handles middleware edge cases for non-standard completion/hover/definition payloads', async () => {
    configurationValues['trace.server'] = 'verbose';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      middleware: {
        provideCompletionItem: (...args: unknown[]) => Promise<unknown>;
        provideHover: (...args: unknown[]) => Promise<unknown>;
        provideDefinition: (...args: unknown[]) => Promise<unknown>;
      };
    };

    const document = {
      uri: { toString: () => 'file:///workspace/edge.md.tpl' },
      languageId: 'templjs-markdown',
    };
    const position = { line: 0, character: 0 };

    await clientOptions.middleware.provideCompletionItem(document, position, {}, {}, () =>
      Promise.resolve({ foo: 'bar' })
    );
    await clientOptions.middleware.provideHover(document, position, {}, () =>
      Promise.resolve({ contents: { value: 'not-an-array' } })
    );
    await clientOptions.middleware.provideDefinition(document, position, {}, () =>
      Promise.resolve([{ location: 'missing-uri-shape' }])
    );

    const traceLines = outputChannel.appendLine.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.includes('[templjs-trace]'));

    expect(traceLines.some((line) => line.includes('completion result count=1'))).toBe(true);
    expect(traceLines.some((line) => line.includes('hover content length=0'))).toBe(true);
    expect(traceLines.some((line) => line.includes('definition first target=unknown'))).toBe(true);

    await clientOptions.middleware.provideDefinition(document, position, {}, () =>
      Promise.resolve([{ uri: { toString: () => 'file:///workspace/from-uri.json' } }])
    );
    await clientOptions.middleware.provideDefinition(document, position, {}, () =>
      Promise.resolve([null])
    );

    const traceLinesAfterUriCases = outputChannel.appendLine.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.includes('[templjs-trace]'));
    expect(
      traceLinesAfterUriCases.some((line) =>
        line.includes('definition first target=file:///workspace/from-uri.json')
      )
    ).toBe(true);
    expect(
      traceLinesAfterUriCases.some((line) => line.includes('definition first target=unknown'))
    ).toBe(true);
  });

  it('suppresses middleware trace logs when trace.server is off', async () => {
    configurationValues['trace.server'] = 'off';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      middleware: {
        provideCompletionItem: (...args: unknown[]) => Promise<unknown>;
      };
    };

    await clientOptions.middleware.provideCompletionItem(
      { uri: { toString: () => 'file:///workspace/no-trace.md.tpl' } },
      { line: 0, character: 0 },
      {},
      {},
      () => Promise.resolve([{ label: 'OnlyOne' }])
    );

    const traceLines = outputChannel.appendLine.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.includes('[templjs-trace]'));
    expect(traceLines.length).toBe(0);
  });

  it('traces active editor changes only when an editor is provided', async () => {
    configurationValues['trace.server'] = 'verbose';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const activeEditorHandler = onDidChangeActiveTextEditor.mock.calls[0][0] as (
      editor: { document: { uri: { toString: () => string }; languageId: string } } | undefined
    ) => void;

    activeEditorHandler(undefined);
    activeEditorHandler({
      document: {
        uri: { toString: () => 'file:///workspace/changed.md.tpl' },
        languageId: 'templjs-markdown',
      },
    });

    const traceLines = outputChannel.appendLine.mock.calls
      .map((call) => call[0])
      .filter((line) => typeof line === 'string' && line.includes('[templjs-trace]'));

    expect(onDidChangeActiveTextEditor).toHaveBeenCalled();
    expect(Array.isArray(traceLines)).toBe(true);
  });

  it('registers synchronize file watchers for templates and schema files', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    expect(createFileSystemWatcher).toHaveBeenCalledWith(
      '**/*.{md,json,yaml,yml,html}.{templ,tmpl,tpl}'
    );
    expect(createFileSystemWatcher).toHaveBeenCalledWith('**/*.{json,yaml,yml}');
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('does not emit custom watcher notifications after deactivation', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const sentBeforeDeactivate = sendNotification.mock.calls.length;
    await module.deactivate();
    const activeEditorHandler = onDidChangeActiveTextEditor.mock.calls[0][0] as (
      editor: { document: { uri: { toString: () => string }; languageId: string } } | undefined
    ) => void;
    activeEditorHandler(undefined);

    expect(sendNotification.mock.calls.length).toBe(sentBeforeDeactivate);
  });

  it('exposes helper behavior through extensionTesting', async () => {
    configurationValues['trace.server'] = 'bogus';
    configurationValues.schemaPath = '  .templjs/root.json  ';
    configurationValues.contentSchemaPath = '   ';
    configurationValues.schemas = {};
    activeTextEditor.document.uri.scheme = 'file';
    activeTextEditor.document.uri.toString = () => 'file:///workspace/test.yaml.templ';
    activeTextEditor.document.getText = () => 'content';

    const module = await import('../src/extension');
    const helpers = module.extensionTesting;

    expect(helpers.getTraceMode()).toBe('off');
    expect(helpers.shouldTrace('messages')).toBe(true);
    expect(helpers.shouldTrace('verbose', 'verbose')).toBe(true);
    expect(helpers.getResultCount(null)).toBe(0);
    expect(helpers.getResultCount([{ label: 'one' }])).toBe(1);
    expect(helpers.getResultCount({ items: [{ label: 'one' }, {}] })).toBe(2);
    expect(helpers.extractLabels([{ label: 'one' }, null, { label: 'two' }])).toEqual([
      'one',
      'two',
    ]);
    expect(helpers.extractLabels({ items: [{ label: 'one' }, { label: 7 }, {}] })).toEqual(['one']);
    expect(helpers.extractLabels({ items: [{ label: '' }] })).toEqual([]);
    expect(helpers.hoverContentToString({ contents: ['a', { value: 'b' }] } as never)).toBe(
      'a | b'
    );
    expect(helpers.hoverContentToString({ contents: [{ language: 'md' }] } as never)).toContain(
      '[object Object]'
    );
    expect(helpers.hoverContentToString({ contents: { value: 'b' } } as never)).toBe('');
    expect(helpers.getFirstTargetUri({ uri: { toString: () => 'file:///x.md' } })).toBe(
      'file:///x.md'
    );
    expect(helpers.getFirstTargetUri([{ targetUri: { toString: () => 'file:///x.json' } }])).toBe(
      'file:///x.json'
    );
    expect(helpers.getFirstTargetUri('bad-result')).toBe('unknown');
    expect(
      helpers.isTempljsDocument({
        uri: { scheme: 'file', fsPath: '/workspace/page.md.templ' },
        languageId: 'plaintext',
      } as never)
    ).toBe(true);
    expect(
      helpers.isTempljsDocument({
        uri: { scheme: 'file', fsPath: '/workspace/page.tmpl' },
        languageId: 'plaintext',
      } as never)
    ).toBe(true);
    expect(
      helpers.isTempljsDocument({
        uri: { scheme: 'file', fsPath: '/workspace/page.tpl' },
        languageId: 'plaintext',
      } as never)
    ).toBe(true);
    expect(
      helpers.isTempljsDocument({
        uri: { scheme: 'file', fsPath: '/workspace/page.md' },
        languageId: 'templjs-markdown',
      } as never)
    ).toBe(true);
    expect(
      helpers.isTempljsDocument({
        uri: { scheme: 'untitled', fsPath: '/workspace/page.md.templ' },
        languageId: 'templjs-markdown',
      } as never)
    ).toBe(false);
    expect(helpers.getActiveDocumentContext()).toEqual({
      uri: 'file:///workspace/test.yaml.templ',
      content: 'content',
    });

    configurationValues.formattingHostLanguages = [' markdown ', 'json', 'bogus'];
    expect(helpers.getFormattingHostLanguagesFromSettings()).toEqual(['markdown', 'json']);

    configurationValues.formattingHostLanguages = undefined;
    configurationValues.defaultFormatter = 'esbenp.prettier-vscode';
    configurationValues['[markdown]'] = {};
    configurationValues['[json]'] = {};
    configurationValues['[yaml]'] = { 'editor.defaultFormatter': 'esbenp.prettier-vscode' };
    expect(helpers.getFormattingHostLanguagesFromSettings()).toEqual([
      'markdown',
      'json',
      'yaml',
      'html',
    ]);

    spawnSync.mockReturnValueOnce({ status: 0, stdout: '/usr/local/bin/markdownlint\n' } as never);
    expect(helpers.discoverBinaryPath('markdownlint')).toBe('/usr/local/bin/markdownlint');

    activeTextEditor.document.uri.scheme = 'untitled';
    expect(helpers.getActiveDocumentContext()).toBeUndefined();
    activeTextEditor.document.uri.scheme = 'file';

    expect(helpers.getSchemaPathFromSettings()).toBe('.templjs/root.json');
    expect(helpers.getContentSchemaPathFromSettings()).toBeUndefined();

    configurationValues.schemaPath = '   ';
    expect(helpers.getSchemaPathFromSettings()).toBeUndefined();

    configurationValues.schemas = {
      '**/*.md.templ': {
        schemaPath: '.templjs/root.json',
      },
    };
    expect(helpers.getSchemaPatternsFromSettings()).toEqual({
      '**/*.md.templ': {
        schemaPath: '.templjs/root.json',
      },
    });

    configurationValues.schemas = {};
    expect(helpers.getSchemaPatternsFromSettings()).toBeUndefined();
    expect(typeof helpers.getTypeScriptSdkPath()).toBe('string');
  });

  it('disposes output channel on deactivate when client was not created', async () => {
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: () => {
        throw new Error('broken path resolution');
      },
    };

    const module = await import('../src/extension');
    module.activate(context as never);
    expect(module.deactivate()).toBeUndefined();
    expect(outputChannel.dispose).toHaveBeenCalled();
  });

  it('thin-client: middleware passes results unchanged from language server without semantic transformation', async () => {
    configurationValues['trace.server'] = 'off';
    const context = {
      subscriptions: [] as Array<{ dispose: () => void }>,
      asAbsolutePath: (value: string) => `/tmp/${value}`,
    };

    const module = await import('../src/extension');
    module.activate(context as never);

    const clientOptions = languageClientConstructor.mock.calls[0][3] as {
      middleware: {
        provideCompletionItem: (...args: unknown[]) => Promise<unknown>;
        provideHover: (...args: unknown[]) => Promise<unknown>;
        provideDefinition: (...args: unknown[]) => Promise<unknown>;
      };
    };

    const document = {
      uri: { toString: () => 'file:///workspace/example.md.tpl' },
    };
    const position = { line: 0, character: 0 };
    const sentinel = Symbol('server-result');

    // Completion: next() result passes through unchanged
    const completionResult = await clientOptions.middleware.provideCompletionItem(
      document,
      position,
      {},
      {},
      () => Promise.resolve(sentinel)
    );
    expect(completionResult).toBe(sentinel);

    // Hover: next() result passes through unchanged
    const hoverResult = await clientOptions.middleware.provideHover(document, position, {}, () =>
      Promise.resolve(sentinel)
    );
    expect(hoverResult).toBe(sentinel);

    // Definition: next() result passes through unchanged
    const definitionResult = await clientOptions.middleware.provideDefinition(
      document,
      position,
      {},
      () => Promise.resolve(sentinel)
    );
    expect(definitionResult).toBe(sentinel);
  });
});
