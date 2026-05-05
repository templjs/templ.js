import * as path from 'path';
import { pathToFileURL } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const getProject = vi.fn();

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
    onDocumentFormatting,
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
    projects: {
      getProject,
    },
  })),
  createSimpleProjectProvider: { name: 'simple-project-provider' },
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
    getProject.mockReset();
    createTempljsLanguagePlugin.mockClear();
  });

  it('wires lifecycle handlers and avoids legacy compatibility registrations', async () => {
    await import('../src/server');

    expect(onInitialize).toHaveBeenCalledWith(expect.any(Function));
    expect(onInitialized).toHaveBeenCalledWith(initialized);
    expect(onShutdown).toHaveBeenCalledWith(shutdown);
    expect(listen).toHaveBeenCalled();

    expect(onNotification).not.toHaveBeenCalled();
    expect(onDidOpenTextDocument).not.toHaveBeenCalled();
    expect(onDidChangeTextDocument).not.toHaveBeenCalled();
    expect(onDidChangeWatchedFiles).not.toHaveBeenCalled();
  });

  it('derives initialize rootUri from documentContext when rootUri is null', async () => {
    await import('../src/server');

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

  it('registers service and language plugin providers', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        { getServicePlugins: () => Array<{ name?: string }>; getLanguagePlugins: () => unknown[] },
      ]
    >;
    const serverOptions = initializeCalls[0][2];

    const servicePlugins = serverOptions.getServicePlugins();
    expect(servicePlugins.map((plugin) => plugin.name)).toEqual([
      'templjs-intellisense',
      'templjs-diagnostics',
      'templjs-markdown-diagnostics',
      'templjs-markdown-host',
      'templjs-yaml',
      'templjs-html-host',
      'templjs-json-host',
    ]);

    serverOptions.getLanguagePlugins();
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({});
  });

  it('advertises capabilities and registers delegation handlers', async () => {
    const languageService = {
      doComplete: vi.fn(async () => ({ isIncomplete: false, items: [] })),
      doHover: vi.fn(async () => null),
      findDefinition: vi.fn(async () => null),
      format: vi.fn(async () => []),
    };

    getProject.mockResolvedValue({
      getLanguageService: () => languageService,
    });

    await import('../src/server');

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
});

describe('authoring transport delegation', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    onDocumentFormatting.mockClear();
    getProject.mockReset();
  });

  it('delegates completion/hover/definition/format requests to language service', async () => {
    const completion = { isIncomplete: false, items: [{ label: 'user' }] };
    const hover = { contents: { kind: 'markdown', value: 'hover' } };
    const definition = [{ targetUri: 'file:///schema.json' }];
    const formatting = [{ newText: 'formatted' }];

    const languageService = {
      doComplete: vi.fn(async () => completion),
      doHover: vi.fn(async () => hover),
      findDefinition: vi.fn(async () => definition),
      format: vi.fn(async () => formatting),
    };

    getProject.mockResolvedValue({
      getLanguageService: () => languageService,
    });

    await import('../src/server');

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

    expect(languageService.doComplete).toHaveBeenCalledTimes(1);
    expect(languageService.doHover).toHaveBeenCalledTimes(1);
    expect(languageService.findDefinition).toHaveBeenCalledTimes(1);
    expect(languageService.format).toHaveBeenCalledTimes(1);
  });
});

describe('isMdTemplateUri', () => {
  let isMdTemplateUri: (uri: string) => boolean;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/server');
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
  let helpers: (typeof import('../src/server'))['serverTesting'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/server');
    helpers = mod.serverTesting;
    helpers.resetRuntimeState();
    consoleLog.mockClear();
    getProject.mockReset();
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

    getProject.mockResolvedValueOnce({
      getLanguageService: () => ({
        doValidation: vi.fn(async () => [{ message: 'yaml issue', source: 'yaml' }]),
        context: {
          language: {
            files: {
              get: () => ({
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
      }),
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///data.yaml.templ', '')
    ).resolves.toEqual([{ message: 'yaml issue', source: 'yaml' }]);

    getProject.mockResolvedValueOnce({
      getLanguageService: () => ({
        doValidation: vi.fn(async () => [
          { message: 'markdown issue', source: 'markdown', code: 'MD022' },
        ]),
        context: {
          language: {
            files: {
              get: () => ({
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
      }),
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///doc.md.tpl', '')
    ).resolves.toEqual([{ message: 'markdown issue', source: 'markdown', code: 'MD022' }]);

    getProject.mockResolvedValueOnce({
      getLanguageService: () => ({
        doValidation: vi.fn(async () => {
          throw new Error('kaboom');
        }),
      }),
    });

    await expect(
      helpers.collectServiceDiagnosticsForDocument('file:///doc.md.tpl', '')
    ).resolves.toEqual([]);

    expect(consoleLog).toHaveBeenCalledWith(
      '[templjs] Host diagnostics skipped for file:///doc.md.tpl: kaboom'
    );
  });
});
