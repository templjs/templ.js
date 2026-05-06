import * as path from 'path';
import { pathToFileURL } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const listen = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
const onDidChangeWatchedFiles = vi.fn();
const onNotification = vi.fn();
const onCompletion = vi.fn();
const onHover = vi.fn();
const onDefinition = vi.fn();
const onDocumentFormatting = vi.fn();
const sendDiagnostics = vi.fn();
const consoleLog = vi.fn();
const consoleWarn = vi.fn();
let connectionSupportsFormatting = true;

const testWorkspaceRoot = path.join(process.cwd(), 'workspace');

function toTestWorkspaceUri(fixtureUri: string): string {
  if (fixtureUri === 'file:///workspace') {
    return pathToFileURL(testWorkspaceRoot).href;
  }

  if (fixtureUri.startsWith('file:///workspace/')) {
    const relativePath = fixtureUri.slice('file:///workspace/'.length);
    return pathToFileURL(path.join(testWorkspaceRoot, relativePath)).href;
  }

  return fixtureUri;
}

const initialize = vi.fn(async () => ({ capabilities: {} }));
const initialized = vi.fn();
const shutdown = vi.fn();
const getLanguageService = vi.fn();
const createSimpleProject = vi.fn((plugins: unknown) => ({ plugins }));

const createTempljsLanguagePlugin = vi.fn(() => ({ name: 'templjs-plugin' }));

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
    ...(connectionSupportsFormatting ? { onDocumentFormatting } : {}),
    sendDiagnostics,
    console: {
      log: consoleLog,
      warn: consoleWarn,
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

vi.mock('@templjs/volar', async (importOriginal) => {
  const real = await importOriginal<typeof import('@templjs/volar')>();
  return {
    ...real,
    createTempljsLanguagePlugin,
  };
});

describe('language-server-bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onInitialized.mockClear();
    onShutdown.mockClear();
    onDidOpenTextDocument.mockClear();
    onDidChangeTextDocument.mockClear();
    onDidChangeWatchedFiles.mockClear();
    onNotification.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    onDocumentFormatting.mockClear();
    sendDiagnostics.mockClear();
    consoleLog.mockClear();
    consoleWarn.mockClear();
    listen.mockClear();
    initialize.mockClear();
    initialized.mockClear();
    shutdown.mockClear();
    getLanguageService.mockReset();
    createSimpleProject.mockClear();
    createTempljsLanguagePlugin.mockClear();
    connectionSupportsFormatting = true;
  });

  it('wires lifecycle handlers and avoids legacy compatibility registrations', async () => {
    await import('../src/index.ts');

    expect(onInitialize).toHaveBeenCalledWith(expect.any(Function));
    expect(onInitialized).toHaveBeenCalledWith(initialized);
    expect(onShutdown).toHaveBeenCalledWith(shutdown);
    expect(listen).not.toHaveBeenCalled();

    expect(onNotification).not.toHaveBeenCalled();
    expect(onDidOpenTextDocument).not.toHaveBeenCalled();
    expect(onDidChangeTextDocument).not.toHaveBeenCalled();
    expect(onDidChangeWatchedFiles).not.toHaveBeenCalled();
  });

  it('derives initialize rootUri from documentContext when rootUri is null', async () => {
    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: null,
      initializationOptions: {
        documentContext: {
          uri: 'file:///tmp/templjs-root-fallback/invalid_example.md.tmpl',
          content: '{{ value }}',
        },
      },
    });

    const firstInitializeCall = initialize.mock.calls[0];
    if (!firstInitializeCall) {
      throw new Error('Expected server.initialize to be called');
    }

    const initializeParams = (firstInitializeCall as unknown[])[0] as { rootUri?: string | null };
    expect(initializeParams?.rootUri).toBe('file:///tmp/templjs-root-fallback');
  });

  it('leaves initialize rootUri undefined when the active document uri is invalid', async () => {
    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: null,
      initializationOptions: {
        documentContext: {
          uri: 'file:///%E0%A4%A',
          content: '{{ value }}',
        },
      },
    });

    const firstInitializeCall = initialize.mock.calls[0];
    const initializeParams = (firstInitializeCall as unknown[])[0] as { rootUri?: string | null };
    expect(initializeParams?.rootUri).toBeNull();
  });

  it('leaves initialize rootUri null when the document uri causes URL parsing to throw', async () => {
    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: null,
      initializationOptions: {
        documentContext: {
          uri: 'file://[bad/path.md',
          content: '{{ value }}',
        },
      },
    });

    const firstInitializeCall = initialize.mock.calls[0];
    const initializeParams = (firstInitializeCall as unknown[])[0] as { rootUri?: string | null };
    expect(initializeParams?.rootUri).toBeNull();
  });

  it('uses derivedRootUri even when fileURLToPath throws for non-localhost host', async () => {
    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: null,
      initializationOptions: {
        documentContext: {
          uri: 'file://remote-host/dir/document.md',
          content: '{{ value }}',
        },
      },
    });

    const firstInitializeCall = initialize.mock.calls[0];
    if (!firstInitializeCall) {
      throw new Error('Expected server.initialize to be called');
    }
    const initializeParams = (firstInitializeCall as unknown[])[0] as { rootUri?: string | null };
    expect(initializeParams?.rootUri).toBe('file://remote-host/dir');
  });

  it('registers service and language plugin providers', async () => {
    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, Array<{ name?: string }>]
    >;
    const simpleProject = initializeCalls[0][1];
    const servicePlugins = initializeCalls[0][2];

    expect(servicePlugins.map((plugin) => plugin.name)).toEqual([
      'templjs-intellisense',
      'templjs-diagnostics',
      'templjs-markdown-diagnostics',
      'templjs-markdown-host',
      'templjs-yaml',
      'templjs-html-host',
      'templjs-json-host',
    ]);

    expect(createSimpleProject).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'templjs-plugin' }),
    ]);
    expect(simpleProject).toEqual({
      plugins: [expect.objectContaining({ name: 'templjs-plugin' })],
    });
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({});
  });

  it('uses workspaceFolders root when rootUri and documentContext are absent', async () => {
    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: null,
      workspaceFolders: [{ uri: toTestWorkspaceUri('file:///workspace'), name: 'test' }],
      initializationOptions: {},
    });

    const firstInitializeCall = initialize.mock.calls[0];
    if (!firstInitializeCall) {
      throw new Error('Expected server.initialize to be called');
    }
    const initializeParams = (firstInitializeCall as unknown[])[0] as { rootUri?: string | null };
    expect(initializeParams?.rootUri).toBe(toTestWorkspaceUri('file:///workspace'));
  });

  it('advertises capabilities and registers delegation handlers', async () => {
    const languageService = {
      doComplete: vi.fn(async () => ({ isIncomplete: false, items: [] })),
      doHover: vi.fn(async () => null),
      findDefinition: vi.fn(async () => null),
      format: vi.fn(async () => []),
    };

    getLanguageService.mockResolvedValue(languageService);

    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<{ capabilities: Record<string, unknown> }>;
    const result = await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    expect(result.capabilities.completionProvider).toEqual({ triggerCharacters: ['.', '|'] });
    expect(result.capabilities.hoverProvider).toBe(true);
    expect(result.capabilities.definitionProvider).toBe(true);
    expect(result.capabilities.documentFormattingProvider).toBe(true);

    expect(onCompletion).toHaveBeenCalledWith(expect.any(Function));
    expect(onHover).toHaveBeenCalledWith(expect.any(Function));
    expect(onDefinition).toHaveBeenCalledWith(expect.any(Function));
    expect(onDocumentFormatting).toHaveBeenCalledWith(expect.any(Function));
  });

  it('preserves existing server capabilities during initialize', async () => {
    initialize.mockResolvedValueOnce({ capabilities: { renameProvider: true } });

    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<{ capabilities: Record<string, unknown> }>;
    const result = await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    expect(result.capabilities.renameProvider).toBe(true);
    expect(result.capabilities.documentFormattingProvider).toBe(true);
  });

  it('skips formatting handler registration when the connection does not support it', async () => {
    connectionSupportsFormatting = false;

    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<{ capabilities: Record<string, unknown> }>;
    const result = await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    expect(result.capabilities.documentFormattingProvider).toBe(false);
    expect(onDocumentFormatting).not.toHaveBeenCalled();
  });
});

describe('authoring transport delegation', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    onDocumentFormatting.mockClear();
    getLanguageService.mockReset();
    connectionSupportsFormatting = true;
  });

  it('delegates completion/hover/definition/format requests to language service', async () => {
    const completion = { isIncomplete: false, items: [{ label: 'user' }] };
    const hover = { contents: { kind: 'markdown', value: 'hover' } };
    const definition = [{ targetUri: 'file:///schema.json' }];
    const formatting = [{ newText: 'formatted' }];

    const languageService = {
      getCompletionItems: vi.fn(async () => completion),
      getHover: vi.fn(async () => hover),
      getDefinition: vi.fn(async () => definition),
      getDocumentFormattingEdits: vi.fn(async () => formatting),
    };

    getLanguageService.mockResolvedValue(languageService);

    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({ rootUri: 'file:///workspace' });

    const completionHandler = onCompletion.mock.calls[0][0] as (
      request: {
        textDocument: { uri: string };
        position: { line: number; character: number };
        context?: unknown;
      },
      token: unknown
    ) => Promise<unknown>;
    const hoverHandler = onHover.mock.calls[0][0] as (
      request: { textDocument: { uri: string }; position: { line: number; character: number } },
      token: unknown
    ) => Promise<unknown>;
    const definitionHandler = onDefinition.mock.calls[0][0] as (
      request: { textDocument: { uri: string }; position: { line: number; character: number } },
      token: unknown
    ) => Promise<unknown>;
    const formattingHandler = onDocumentFormatting.mock.calls[0][0] as (
      request: {
        textDocument: { uri: string };
        options: { insertSpaces: boolean; tabSize: number };
      },
      token: unknown
    ) => Promise<unknown>;

    await expect(
      completionHandler(
        {
          textDocument: { uri: 'file:///workspace/doc.md.tpl' },
          position: { line: 0, character: 2 },
          context: {},
        },
        {}
      )
    ).resolves.toEqual(completion);

    await expect(
      hoverHandler(
        {
          textDocument: { uri: 'file:///workspace/doc.md.tpl' },
          position: { line: 0, character: 2 },
        },
        {}
      )
    ).resolves.toEqual(hover);

    await expect(
      definitionHandler(
        {
          textDocument: { uri: 'file:///workspace/doc.md.tpl' },
          position: { line: 0, character: 2 },
        },
        {}
      )
    ).resolves.toEqual(definition);

    await expect(
      formattingHandler(
        {
          textDocument: { uri: 'file:///workspace/doc.md.tpl' },
          options: { insertSpaces: true, tabSize: 2 },
        },
        {}
      )
    ).resolves.toEqual(formatting);

    expect(languageService.getCompletionItems).toHaveBeenCalledTimes(1);
    expect(languageService.getHover).toHaveBeenCalledTimes(1);
    expect(languageService.getDefinition).toHaveBeenCalledTimes(1);
    expect(languageService.getDocumentFormattingEdits).toHaveBeenCalledTimes(1);
  });
});

describe('isMdTemplateUri', () => {
  let isMdTemplateUri: (uri: string) => boolean;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/index.ts');
    isMdTemplateUri = mod.isMdTemplateUri;
  });

  it('returns true for markdown template uris', () => {
    expect(isMdTemplateUri('file:///doc.md.templ')).toBe(true);
    expect(isMdTemplateUri('file:///doc.md.tmpl')).toBe(true);
    expect(isMdTemplateUri('file:///doc.md.tpl')).toBe(true);
  });

  it('returns false for non-markdown template uris', () => {
    expect(isMdTemplateUri('file:///doc.md')).toBe(false);
    expect(isMdTemplateUri('file:///doc.html.templ')).toBe(false);
  });
});

describe('serverTesting helpers', () => {
  let helpers: (typeof import('../src/index.ts'))['serverTesting'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/index.ts');
    helpers = mod.serverTesting;
    helpers.resetRuntimeState();
    consoleLog.mockClear();
    getLanguageService.mockReset();
  });

  it('classifies schema-like uris and yaml templated uris', () => {
    expect(helpers.isLikelySchemaUri('file:///schema.json')).toBe(true);
    expect(helpers.isLikelySchemaUri('file:///schema.yaml')).toBe(true);
    expect(helpers.isLikelySchemaUri('file:///template.yaml.templ')).toBe(false);
    expect(helpers.isYamlTemplateUri('file:///data.yaml.templ')).toBe(true);
    expect(helpers.isYamlTemplateUri('file:///data.md.templ')).toBe(false);
  });

  it('collects delegated host diagnostics from language service and handles failures', async () => {
    helpers.setServerTraceMode('verbose');

    getLanguageService.mockResolvedValueOnce({
      getDiagnostics: vi.fn(async () => [{ message: 'yaml issue', source: 'yaml' }]),
      context: {
        language: {
          scripts: {
            get: () => ({
              id: URI.parse('file:///data.yaml.templ'),
              languageId: 'templjs-yaml',
              generated: {
                code: { id: 'root', languageId: 'yaml', mappings: [{}] },
              },
            }),
          },
        },
        documents: {
          getVirtualCodeUri: () => 'file:///virtual.yaml',
          getMaps: function* () {
            yield { id: 'map-1' };
          },
        },
        disabledVirtualFileUris: new Set(['file:///virtual.yaml']),
      },
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///data.yaml.templ', '')
    ).resolves.toEqual([{ message: 'yaml issue', source: 'yaml' }]);

    getLanguageService.mockResolvedValueOnce({
      getDiagnostics: vi.fn(async () => [
        { message: 'markdown issue', source: 'markdown', code: 'MD022' },
      ]),
      context: {
        language: {
          scripts: {
            get: () => ({
              id: URI.parse('file:///doc.md.tpl'),
              languageId: 'templjs-markdown',
              generated: {
                code: { id: 'root', languageId: 'markdown', mappings: [{}] },
              },
            }),
          },
        },
        documents: {
          getVirtualCodeUri: () => 'file:///virtual.md',
          getMaps: function* () {
            yield { id: 'map-md-1' };
          },
        },
        disabledVirtualFileUris: new Set(),
      },
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///doc.md.tpl', '')
    ).resolves.toEqual([{ message: 'markdown issue', source: 'markdown', code: 'MD022' }]);

    getLanguageService.mockResolvedValueOnce({
      getDiagnostics: vi.fn(async () => {
        throw new Error('kaboom');
      }),
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///doc.md.tpl', '')
    ).resolves.toEqual([]);

    expect(consoleLog).toHaveBeenCalledWith(
      '[templjs] Host diagnostics skipped for file:///doc.md.tpl: kaboom'
    );
  });

  it('traces yaml diagnostics without virtual map helpers and stringifies non-Error failures', async () => {
    helpers.setServerTraceMode('verbose');

    getLanguageService.mockResolvedValueOnce({
      getDiagnostics: vi.fn(async () => [
        { message: 'yaml issue', source: 'YAML' },
        { message: 'other issue', source: 'json' },
      ]),
      context: {
        language: {
          scripts: {
            get: () => ({
              id: URI.parse('file:///data.yaml.templ'),
              languageId: 'templjs-yaml',
              generated: {
                code: { id: 'root', languageId: 'yaml' },
              },
            }),
          },
        },
        documents: {},
        disabledVirtualFileUris: new Set(),
      },
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///data.yaml.templ', '')
    ).resolves.toHaveLength(2);

    getLanguageService.mockResolvedValueOnce({
      getDiagnostics: vi.fn(async () => {
        throw 'boom';
      }),
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///doc.md.tpl', '')
    ).resolves.toEqual([]);

    expect(consoleLog).toHaveBeenCalledWith(
      '[templjs] Host diagnostics skipped for file:///doc.md.tpl: boom'
    );
  });

  it('does not re-listen once the server was started and exposes runtime setters', async () => {
    const mod = await import('../src/index.ts');
    mod.startTempljsLanguageServer();
    expect(listen.mock.calls.length).toBe(1);

    mod.startTempljsLanguageServer();
    expect(listen.mock.calls.length).toBe(1);

    helpers.setStoredWorkspaceRoot('/workspace');
    helpers.setStoredInitializationOptions({ schemaPath: '.templjs/schema.json' });
    helpers.setServerTraceMode('messages');
    helpers.resetRuntimeState();
  });
});
