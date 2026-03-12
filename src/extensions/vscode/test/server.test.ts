import { beforeEach, describe, expect, it, vi } from 'vitest';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const listen = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
const onCompletion = vi.fn();
const onHover = vi.fn();
const onDefinition = vi.fn();
const sendDiagnostics = vi.fn();
const consoleLog = vi.fn();
const consoleWarn = vi.fn();

const initialize = vi.fn(async () => ({ capabilities: {} }));
const initialized = vi.fn();
const shutdown = vi.fn();

const createTempljsLanguagePlugin = vi.fn(() => ({ name: 'templjs-plugin' }));
const getCompletions = vi.fn(() => [{ label: 'user', kind: 'variable' }]);
const getHover = vi.fn(() => ({ contents: 'user: object' }));
const getDefinition = vi.fn(() => null);
const resolveScopedPathInText = vi.fn((_: string, path: string) => path);
const collectDiagnostics = vi.fn(() => []);
class IntellisenseProviderMock {
  getCompletions = getCompletions;
  getHover = getHover;
  getDefinition = getDefinition;
}
const readFileSync = vi.fn(() => '{"type":"object","properties":{"user":{"type":"object"}}}');
const existsSync = vi.fn(() => true);
const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('fs', () => ({
  existsSync,
  readFileSync,
}));

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onCompletion,
    onHover,
    onDefinition,
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
  })),
  createSimpleProjectProvider: { name: 'simple-project-provider' },
}));

vi.mock('@templjs/volar', () => ({
  createTempljsLanguagePlugin,
  IntellisenseProvider: IntellisenseProviderMock,
  resolveScopedPathInText,
  collectDiagnostics,
}));

describe('language-server-bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onInitialized.mockClear();
    onShutdown.mockClear();
    onDidOpenTextDocument.mockClear();
    onDidChangeTextDocument.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    sendDiagnostics.mockClear();
    consoleLog.mockClear();
    consoleWarn.mockClear();
    listen.mockClear();
    initialize.mockClear();
    initialized.mockClear();
    shutdown.mockClear();
    createTempljsLanguagePlugin.mockClear();
    getCompletions.mockClear();
    getHover.mockClear();
    getDefinition.mockClear();
    resolveScopedPathInText.mockClear();
    collectDiagnostics.mockClear();
    readFileSync.mockClear();
    existsSync.mockClear();
    existsSync.mockReturnValue(true);
    fetchMock.mockClear();
  });

  it('wires connection lifecycle handlers and starts listening', async () => {
    await import('../src/server');

    expect(onInitialize).toHaveBeenCalledWith(expect.any(Function));
    expect(onInitialized).toHaveBeenCalledWith(initialized);
    expect(onShutdown).toHaveBeenCalledWith(shutdown);
    expect(onDidOpenTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(onDidChangeTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(onCompletion).toHaveBeenCalledWith(expect.any(Function));
    expect(onHover).toHaveBeenCalledWith(expect.any(Function));
    expect(listen).toHaveBeenCalled();
  });

  it('registers templjs language plugin provider', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    await initializeHandler({ rootUri: 'file:///workspace' });

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
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({});
  });

  it('registers expected templated file extensions in server options', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    await initializeHandler({ rootUri: 'file:///workspace' });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        {
          watchFileExtensions: string[];
          getServicePlugins: () => unknown[];
          getLanguagePlugins: () => unknown[];
        },
      ]
    >;
    const serverOptions = initializeCalls[0][2];

    expect(serverOptions.watchFileExtensions).toEqual(
      expect.arrayContaining(['.templ.md', '.templ.json', '.templ.yaml', '.templ.html', '.tmpl.md'])
    );
  });

  it('binds initialized and shutdown callbacks to server instance handlers', async () => {
    await import('../src/server');

    expect(onInitialized).toHaveBeenCalledWith(initialized);
    expect(onShutdown).toHaveBeenCalledWith(shutdown);
  });

  it('loads schema from initializationOptions.schemaPath and passes it to plugin options', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: { schemaPath: '.templjs/schema.json' },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/schema.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
          },
        },
      },
      schemaUri: 'file:///workspace/.templjs/schema.json',
    });
  });

  it('falls back to empty schema options when schema file cannot be read', async () => {
    readFileSync.mockImplementationOnce(() => {
      throw new Error('missing schema');
    });

    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: { schemaPath: '.templjs/missing.json' },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({});
  });

  it('loads content schema from initializationOptions.contentSchemaPath', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: '.templjs/schema.json',
        contentSchemaPath: '.templjs/content-schema.json',
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/schema.json', 'utf-8');
    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/content-schema.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
          },
        },
      },
      schemaUri: 'file:///workspace/.templjs/schema.json',
      contentSchema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
          },
        },
      },
      contentSchemaUri: 'file:///workspace/.templjs/content-schema.json',
    });
  });

  it('loads schema fragment from initializationOptions.schemaPath with JSON pointer', async () => {
    readFileSync.mockReturnValueOnce(
      JSON.stringify({
        $defs: {
          relationship: {
            type: 'object',
            properties: {
              target: { type: 'string' },
              type: { type: 'string' },
            },
          },
        },
      })
    );

    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: { schemaPath: '.templjs/common.json#/$defs/relationship' },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/common.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          type: { type: 'string' },
        },
      },
      schemaUri: 'file:///workspace/.templjs/common.json',
    });
  });

  it('loads schema from HTTPS URL when configured', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"type":"object","properties":{"post":{"type":"object"}}}',
    });

    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: 'https://schemas.example.com/schema.json',
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://schemas.example.com/schema.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          post: {
            type: 'object',
          },
        },
      },
      schemaUri: 'https://schemas.example.com/schema.json',
    });
  });

  it('applies precedence per schema type: inline > root > setting', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: '.templjs/setting-schema.json',
        contentSchemaPath: '.templjs/setting-content.json',
        documentContext: {
          uri: 'file:///workspace/backlog/item.md.templ',
          content:
            '---\n$templ-schema: .templjs/root-schema.json\n$content-schema: .templjs/root-content.json\n---\n{{# schema: .templjs/inline-schema.json }}\n{{# content-schema: .templjs/inline-content.json }}',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/inline-schema.json', 'utf-8');
    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/inline-content.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: 'file:///workspace/.templjs/inline-schema.json',
        contentSchemaUri: 'file:///workspace/.templjs/inline-content.json',
      })
    );
  });

  it('applies root properties when inline directives are absent', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: '.templjs/setting-schema.json',
        contentSchemaPath: '.templjs/setting-content.json',
        documentContext: {
          uri: 'file:///workspace/docs/page.md.templ',
          content:
            '---\n$templ-schema: .templjs/root-schema.json\n$content-schema: .templjs/root-content.json\n---\n# body',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/root-schema.json', 'utf-8');
    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/root-content.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: 'file:///workspace/.templjs/root-schema.json',
        contentSchemaUri: 'file:///workspace/.templjs/root-content.json',
      })
    );
  });

  it('uses glob-matched settings when no inline or root schema is provided', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: '.templjs/default-schema.json',
        contentSchemaPath: '.templjs/default-content.json',
        schemaPatterns: {
          'backlog/**': {
            schemaPath: '.templjs/backlog-schema.json',
            contentSchemaPath: '.templjs/backlog-content.json',
          },
        },
        documentContext: {
          uri: 'file:///workspace/backlog/work-item.md.templ',
          content: 'plain content',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/backlog-schema.json', 'utf-8');
    expect(readFileSync).toHaveBeenCalledWith('/workspace/.templjs/backlog-content.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: 'file:///workspace/.templjs/backlog-schema.json',
        contentSchemaUri: 'file:///workspace/.templjs/backlog-content.json',
      })
    );
  });

  it('provides completion items for open document content', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/sample.md.templ',
          content: '{{ user.n }}',
        },
        schemaPath: '.templjs/schema.json',
      },
    });

    const completionHandler = onCompletion.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => unknown[];

    const completions = completionHandler({
      textDocument: { uri: 'file:///workspace/sample.md.templ' },
      position: { line: 0, character: 9 },
    });

    expect(Array.isArray(completions)).toBe(true);
  });

  it('advertises completion and hover capabilities on initialize', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<{ capabilities: Record<string, unknown> }>;

    const result = await initializeHandler({ rootUri: 'file:///workspace' });

    expect(result.capabilities.completionProvider).toEqual({ triggerCharacters: ['.', '|'] });
    expect(result.capabilities.hoverProvider).toBe(true);
    expect(result.capabilities.definitionProvider).toBe(true);
    expect(result.capabilities.textDocumentSync).toBe(2);
  });

  it('returns schema file definition when cursor is on a frontmatter schema path', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    const documentText = [
      '---',
      'type: milestone',
      '"$schema": schemas/work-management/frontmatter/milestone.json',
      '---',
      '{{ value }}',
    ].join('\n');

    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/templates/milestone.md.tpl',
          content: documentText,
        },
      },
    });

    const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => { uri: string } | null;

    const result = definitionHandler({
      textDocument: { uri: 'file:///workspace/templates/milestone.md.tpl' },
      position: { line: 2, character: 18 },
    });

    expect(result).toBeTruthy();
    expect(result?.uri).toBe(
      'file:///workspace/schemas/work-management/frontmatter/milestone.json'
    );
  });

  // ── $schema / $content_schema alias recognition ──────────────────────────

  it('recognises $schema as an alias for $templ-schema in YAML frontmatter', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/templates/page.md.tpl',
          content: '---\ntype: page\n"$schema": schemas/page/frontmatter.json\n---\n{{ title }}',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/schemas/page/frontmatter.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: 'file:///workspace/schemas/page/frontmatter.json',
      })
    );
  });

  it('recognises $content_schema (underscore) as an alias for $content-schema in YAML frontmatter', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/templates/page.md.tpl',
          content:
            '---\ntype: page\n"$content_schema": schemas/page/content.json\n---\n{{ title }}',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/schemas/page/content.json', 'utf-8');
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSchemaUri: 'file:///workspace/schemas/page/content.json',
      })
    );
  });

  it('loads both $schema and $content_schema simultaneously (real template format)', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/templates/reference/work-management/project.md.tpl',
          content: [
            '---',
            'type: project',
            '"$schema": schemas/work-management/frontmatter/project.json',
            '"$content_schema": schemas/work-management/content/project.json',
            '---',
            '{{ narrative }}',
          ].join('\n'),
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      '/workspace/schemas/work-management/frontmatter/project.json',
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      '/workspace/schemas/work-management/content/project.json',
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: 'file:///workspace/schemas/work-management/frontmatter/project.json',
        contentSchemaUri: 'file:///workspace/schemas/work-management/content/project.json',
      })
    );
  });

  it('parses CRLF frontmatter and resolves both schema aliases', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/templates/reference/work-management/milestone.md.tpl',
          content: [
            '---',
            'type: milestone',
            '"$schema": schemas/work-management/frontmatter/milestone.json',
            '"$content_schema": schemas/work-management/content/milestone.json',
            '---',
            '{{ narrative }}',
          ].join('\r\n'),
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      '/workspace/schemas/work-management/frontmatter/milestone.json',
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      '/workspace/schemas/work-management/content/milestone.json',
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: 'file:///workspace/schemas/work-management/frontmatter/milestone.json',
        contentSchemaUri: 'file:///workspace/schemas/work-management/content/milestone.json',
      })
    );
  });

  it('$templ-schema still takes precedence over $schema alias', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/templates/page.md.tpl',
          content: [
            '---',
            '"$templ-schema": schemas/templ-specific.json',
            '"$schema": schemas/generic.json',
            '---',
          ].join('\n'),
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith('/workspace/schemas/templ-specific.json', 'utf-8');
    expect(readFileSync).not.toHaveBeenCalledWith('/workspace/schemas/generic.json', 'utf-8');
  });

  // ── Schema load logging ───────────────────────────────────────────────────

  it('logs successful schema file loads to connection.console.log', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: { schemaPath: '.templjs/schema.json' },
    });

    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Loaded schema from file'));
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('logs schema file read errors to connection.console.log (not console.warn)', async () => {
    readFileSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: { schemaPath: '.templjs/missing.json' },
    });

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('ENOENT: no such file or directory')
    );
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('logs HTTP error responses from URL schema loads to connection.console.log', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' });

    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: { schemaPath: 'https://schemas.example.com/missing.json' },
    });

    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('404'));
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('logs "No schemas loaded" when no schema spec is found in document or settings', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {},
    });

    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('No schemas loaded'));
  });

  it('logs schema resolution details (schemaPath, contentSchemaPath) for each document', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: '.templjs/schema.json',
        contentSchemaPath: '.templjs/content.json',
        documentContext: {
          uri: 'file:///workspace/templates/page.md.tpl',
          content: 'plain content',
        },
      },
    });

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Schema resolution for.*page\.md\.tpl.*schemaPath=/)
    );
  });

  // ── Per-document schema reload on open ────────────────────────────────────

  it('re-resolves schemas from frontmatter when a document is opened after initialize', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    // Initialize with no schema context
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {},
    });

    readFileSync.mockClear();

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;

    openHandler({
      textDocument: {
        uri: 'file:///workspace/templates/project.md.tpl',
        languageId: 'templjs-markdown',
        version: 1,
        text: ['---', '"$schema": schemas/project.json', '---', '{{ narrative }}'].join('\n'),
      },
    });

    // Allow the async reload to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(readFileSync).toHaveBeenCalledWith('/workspace/schemas/project.json', 'utf-8');
  });

  it('per-document reload also picks up $content_schema from newly opened document', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {},
    });

    readFileSync.mockClear();

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;

    openHandler({
      textDocument: {
        uri: 'file:///workspace/templates/record.md.tpl',
        languageId: 'templjs-markdown',
        version: 1,
        text: [
          '---',
          '"$schema": schemas/fm/record.json',
          '"$content_schema": schemas/content/record.json',
          '---',
          '{{ body }}',
        ].join('\n'),
      },
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(readFileSync).toHaveBeenCalledWith('/workspace/schemas/fm/record.json', 'utf-8');
    expect(readFileSync).toHaveBeenCalledWith('/workspace/schemas/content/record.json', 'utf-8');
  });

  it('applies incremental document changes before completion requests', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: 'file:///workspace',
      initializationOptions: {
        documentContext: {
          uri: 'file:///workspace/sample.md.templ',
          content: '{{ user. }}',
        },
      },
    });

    const changeHandler = onDidChangeTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      contentChanges: Array<{
        range?: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        text: string;
      }>;
    }) => void;

    changeHandler({
      textDocument: { uri: 'file:///workspace/sample.md.templ' },
      contentChanges: [
        {
          range: {
            start: { line: 0, character: 8 },
            end: { line: 0, character: 8 },
          },
          text: 'n',
        },
      ],
    });

    const completionHandler = onCompletion.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => unknown[];

    completionHandler({
      textDocument: { uri: 'file:///workspace/sample.md.templ' },
      position: { line: 0, character: 9 },
    });

    expect(getCompletions).toHaveBeenCalledWith(
      '{{ user.n }}',
      expect.any(Number),
      expect.any(Object)
    );
  });
});
