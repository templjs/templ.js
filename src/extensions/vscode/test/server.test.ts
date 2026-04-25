import * as path from 'path';
import { pathToFileURL } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileChangeType } from '@volar/language-server';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const listen = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
const onDidChangeWatchedFiles = vi.fn();
const onCompletion = vi.fn();
const onHover = vi.fn();
const onDefinition = vi.fn();
const sendDiagnostics = vi.fn();
const consoleLog = vi.fn();
const consoleWarn = vi.fn();
const FILE_CHANGE_TYPE_CHANGED = FileChangeType.Changed;
const testWorkspaceRoot = path.join(process.cwd(), 'workspace');

function toTestWorkspacePath(fixturePath: string): string {
  if (fixturePath === '/workspace') {
    return testWorkspaceRoot;
  }

  if (fixturePath.startsWith('/workspace/')) {
    return path.join(testWorkspaceRoot, fixturePath.slice('/workspace/'.length));
  }

  return fixturePath;
}

function toTestWorkspaceUri(fixtureUri: string): string {
  if (fixtureUri === 'file:///workspace') {
    return pathToFileURL(testWorkspaceRoot).href;
  }

  if (fixtureUri.startsWith('file:///workspace/')) {
    return pathToFileURL(toTestWorkspacePath(fixtureUri.replace('file://', ''))).href;
  }

  return fixtureUri;
}

const initialize = vi.fn(async () => ({ capabilities: {} }));
const initialized = vi.fn();
const shutdown = vi.fn();
const getProject = vi.fn();

const createTempljsLanguagePlugin = vi.fn(() => ({ name: 'templjs-plugin' }));
const getCompletions = vi.fn<(...args: any[]) => any[]>(() => [{ label: 'user', kind: 6 }]);
const getHover = vi.fn<(...args: any[]) => any>(() => ({
  contents: { kind: 'markdown', value: 'user: object' },
}));
const getDefinition = vi.fn(() => null);
const collectDiagnosticsFunc = vi.fn<(...args: any[]) => any[]>(() => []);
const resolveScopedPathInText = vi.fn((_: string, path: string) => path);
const collectDiagnostics = collectDiagnosticsFunc;

function getLineDetails(text: string, offset: number): { line: string; lineStart: number } {
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const lineEnd = text.indexOf('\n', offset);
  return {
    line: text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd),
    lineStart,
  };
}

function resolveMockFrontmatterDefinition(
  text: string,
  offset: number,
  options?: { schemaUri?: string; documentUri?: string; workspaceRoot?: string }
): {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
} | null {
  const { line } = getLineDetails(text, offset);
  const schemaMatch = line.match(/\$schema"?\s*:\s*([^\s]+)/);
  if (schemaMatch && options?.workspaceRoot) {
    return {
      uri: pathToFileURL(path.join(options.workspaceRoot, schemaMatch[1])).href,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  const pathMatch = line.match(/schema_path\s*:\s*([^\s]+)/);
  if (pathMatch && options?.workspaceRoot) {
    return {
      uri: pathToFileURL(path.join(options.workspaceRoot, pathMatch[1])).href,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  if (line.includes('type:') && options?.schemaUri) {
    return {
      uri: options.schemaUri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  return null;
}

class IntellisenseProviderMock {
  getCompletions = getCompletions;
  getHover = getHover;
  getDefinition = getDefinition;
}

class TempljsServicePluginMock {
  getCompletions = getCompletions;
  getHover = getHover;
  getDefinition = vi.fn(
    (
      text: string,
      offset: number,
      options?: { schemaUri?: string; contentSchemaUri?: string; workspaceRoot?: string }
    ) => {
      const resolved = resolveMockFrontmatterDefinition(text, offset, options);
      if (resolved) {
        return resolved;
      }

      const uri = options?.schemaUri ?? options?.contentSchemaUri;
      if (!uri) {
        return null;
      }

      return {
        uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      };
    }
  );
  collectDiagnostics = collectDiagnosticsFunc;
}
const readFileSync = vi.fn(() => '{"type":"object","properties":{"user":{"type":"object"}}}');
const existsSync = vi.fn(() => true);
const access = vi.fn(async () => undefined);
const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('fs', () => ({
  constants: {
    F_OK: 0,
  },
  existsSync,
  readFileSync,
  promises: {
    access,
  },
}));

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onDidChangeWatchedFiles,
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
    IntellisenseProvider: IntellisenseProviderMock,
    TempljsServicePlugin: TempljsServicePluginMock,
    resolveScopedPathInText,
    collectDiagnostics,
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
    getProject.mockReset();
    createTempljsLanguagePlugin.mockClear();
    getCompletions.mockClear();
    getHover.mockClear();
    getDefinition.mockClear();
    resolveScopedPathInText.mockClear();
    collectDiagnostics.mockClear();
    readFileSync.mockClear();
    existsSync.mockClear();
    existsSync.mockReturnValue(true);
    access.mockClear();
    access.mockResolvedValue(undefined);
    fetchMock.mockClear();
  });

  it('wires connection lifecycle handlers and starts listening', async () => {
    await import('../src/server');

    // Module-level handlers registered immediately on import
    expect(onInitialize).toHaveBeenCalledWith(expect.any(Function));
    expect(onInitialized).toHaveBeenCalledWith(initialized);
    expect(onShutdown).toHaveBeenCalledWith(shutdown);
    expect(onDidOpenTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(onDidChangeTextDocument).toHaveBeenCalledWith(expect.any(Function));
    expect(onDidChangeWatchedFiles).toHaveBeenCalledWith(expect.any(Function));
    expect(listen).toHaveBeenCalled();

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });
  });

  it('registers templjs language plugin provider', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        { getServicePlugins: () => unknown[]; getLanguagePlugins: () => unknown[] },
      ]
    >;
    const serverOptions = initializeCalls[0][2];

    const servicePlugins = serverOptions.getServicePlugins() as Array<{ name?: string }>;
    expect(servicePlugins.map((plugin) => plugin.name)).toEqual([
      'templjs-html',
      'templjs-json',
      'templjs-markdown',
      'templjs-intellisense',
    ]);
    serverOptions.getLanguagePlugins();
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({});
  });

  it('registers expected templated file extensions in server options', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => unknown;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

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

    expect(serverOptions.watchFileExtensions).toEqual([
      '.html.templ',
      '.html.tmpl',
      '.html.tpl',
      '.json.templ',
      '.json.tmpl',
      '.json.tpl',
      '.md.templ',
      '.md.tmpl',
      '.md.tpl',
      '.yaml.templ',
      '.yaml.tmpl',
      '.yaml.tpl',
      '.yml.templ',
      '.yml.tmpl',
      '.yml.tpl',
    ]);
  });

  it('reloads diagnostics for open documents when schema files change on disk', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: { schemaPath: '.templjs/schema.json' },
    });

    vi.useFakeTimers();
    try {
      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      didOpenHandler({
        textDocument: {
          uri: toTestWorkspaceUri('file:///workspace/templates/sample.md.tpl'),
          text: '{{ user.name }}',
        },
      });

      await vi.runAllTimersAsync();
      expect(sendDiagnostics).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: toTestWorkspaceUri('file:///workspace/templates/sample.md.tpl'),
        })
      );
      sendDiagnostics.mockClear();
      const schemaReadsAfterInitialOpen = readFileSync.mock.calls.length;

      const watchedFilesHandler = onDidChangeWatchedFiles.mock.calls[0][0] as (event: {
        changes: Array<{ uri: string; type: number }>;
      }) => void;
      watchedFilesHandler({
        changes: [
          {
            uri: toTestWorkspaceUri('file:///workspace/.templjs/schema.json'),
            type: FILE_CHANGE_TYPE_CHANGED,
          },
        ],
      });

      await vi.runAllTimersAsync();

      expect(readFileSync.mock.calls.length).toBeGreaterThan(schemaReadsAfterInitialOpen);
      const schemaReadCallIndexAfterCheckpoint = readFileSync.mock.calls
        .slice(schemaReadsAfterInitialOpen)
        .findIndex((args) => {
          const [filePath, encoding] = args as unknown as [string, string];
          return (
            filePath === toTestWorkspacePath('/workspace/.templjs/schema.json') &&
            encoding === 'utf-8'
          );
        });
      expect(schemaReadCallIndexAfterCheckpoint).toBeGreaterThanOrEqual(0);

      expect(sendDiagnostics).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: toTestWorkspaceUri('file:///workspace/templates/sample.md.tpl'),
        })
      );
    } finally {
      vi.useRealTimers();
    }
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: { schemaPath: '.templjs/schema.json' },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/schema.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
          },
        },
      },
      schemaUri: toTestWorkspaceUri('file:///workspace/.templjs/schema.json'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
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

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/schema.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/content-schema.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
          },
        },
      },
      schemaUri: toTestWorkspaceUri('file:///workspace/.templjs/schema.json'),
      contentSchema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
          },
        },
      },
      contentSchemaUri: toTestWorkspaceUri('file:///workspace/.templjs/content-schema.json'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: { schemaPath: '.templjs/common.json#/$defs/relationship' },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/common.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith({
      schema: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          type: { type: 'string' },
        },
      },
      schemaUri: toTestWorkspaceUri('file:///workspace/.templjs/common.json'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        schemaPath: '.templjs/setting-schema.json',
        contentSchemaPath: '.templjs/setting-content.json',
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/backlog/item.md.templ'),
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

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/inline-schema.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/inline-content.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri('file:///workspace/.templjs/inline-schema.json'),
        contentSchemaUri: toTestWorkspaceUri('file:///workspace/.templjs/inline-content.json'),
      })
    );
  });

  it('applies root properties when inline directives are absent', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        schemaPath: '.templjs/setting-schema.json',
        contentSchemaPath: '.templjs/setting-content.json',
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/docs/page.md.templ'),
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

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/root-schema.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/root-content.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri('file:///workspace/.templjs/root-schema.json'),
        contentSchemaUri: toTestWorkspaceUri('file:///workspace/.templjs/root-content.json'),
      })
    );
  });

  it('uses glob-matched settings when no inline or root schema is provided', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
          uri: toTestWorkspaceUri('file:///workspace/backlog/work-item.md.templ'),
          content: 'plain content',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[]; watchFileExtensions: string[] }]
    >;
    const serverOptions = initializeCalls[0][2];
    serverOptions.getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/backlog-schema.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/.templjs/backlog-content.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri('file:///workspace/.templjs/backlog-schema.json'),
        contentSchemaUri: toTestWorkspaceUri('file:///workspace/.templjs/backlog-content.json'),
      })
    );
  });

  it('advertises completion and hover capabilities on initialize', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<{ capabilities: Record<string, unknown> }>;

    const result = await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    expect(result.capabilities.completionProvider).toEqual({ triggerCharacters: ['.', '|'] });
    expect(result.capabilities.hoverProvider).toBe(true);
    expect(result.capabilities.definitionProvider).toBe(true);
    expect(result.capabilities.textDocumentSync).toBe(2);
  });

  it('registers transport delegation handlers for completion, hover, and definition', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<{ capabilities: Record<string, unknown> }>;

    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    expect(onCompletion).toHaveBeenCalledWith(expect.any(Function));
    expect(onHover).toHaveBeenCalledWith(expect.any(Function));
    expect(onDefinition).toHaveBeenCalledWith(expect.any(Function));
  });

  // ── $schema / $content_schema alias recognition ──────────────────────────

  it('recognises $schema as an alias for $templ-schema in YAML frontmatter', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/templates/page.md.tpl'),
          content: '---\ntype: page\n"$schema": schemas/page/frontmatter.json\n---\n{{ title }}',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/page/frontmatter.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri('file:///workspace/schemas/page/frontmatter.json'),
      })
    );
  });

  it('recognises $content_schema (underscore) as an alias for $content-schema in YAML frontmatter', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/templates/page.md.tpl'),
          content:
            '---\ntype: page\n"$content_schema": schemas/page/content.json\n---\n{{ title }}',
        },
      },
    });

    const initializeCalls = initialize.mock.calls as unknown as Array<
      [unknown, unknown, { getLanguagePlugins: () => unknown[] }]
    >;
    initializeCalls[0][2].getLanguagePlugins();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/page/content.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSchemaUri: toTestWorkspaceUri('file:///workspace/schemas/page/content.json'),
      })
    );
  });

  it('resolves ./ schema paths relative to the current document directory', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri(
            'file:///workspace/templates/reference/work-management/project.md.tpl'
          ),
          content: [
            '---',
            'type: project',
            '"$schema": ./schemas/work-management/frontmatter/project.json',
            '"$content_schema": ./schemas/work-management/content/project.json',
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
      toTestWorkspacePath(
        '/workspace/templates/reference/work-management/schemas/work-management/frontmatter/project.json'
      ),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath(
        '/workspace/templates/reference/work-management/schemas/work-management/content/project.json'
      ),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri(
          'file:///workspace/templates/reference/work-management/schemas/work-management/frontmatter/project.json'
        ),
        contentSchemaUri: toTestWorkspaceUri(
          'file:///workspace/templates/reference/work-management/schemas/work-management/content/project.json'
        ),
      })
    );
  });

  it('loads both $schema and $content_schema simultaneously (real template format)', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri(
            'file:///workspace/templates/reference/work-management/project.md.tpl'
          ),
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
      toTestWorkspacePath('/workspace/schemas/work-management/frontmatter/project.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/work-management/content/project.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri(
          'file:///workspace/schemas/work-management/frontmatter/project.json'
        ),
        contentSchemaUri: toTestWorkspaceUri(
          'file:///workspace/schemas/work-management/content/project.json'
        ),
      })
    );
  });

  it('parses CRLF frontmatter and resolves both schema aliases', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri(
            'file:///workspace/templates/reference/work-management/milestone.md.tpl'
          ),
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
      toTestWorkspacePath('/workspace/schemas/work-management/frontmatter/milestone.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/work-management/content/milestone.json'),
      'utf-8'
    );
    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaUri: toTestWorkspaceUri(
          'file:///workspace/schemas/work-management/frontmatter/milestone.json'
        ),
        contentSchemaUri: toTestWorkspaceUri(
          'file:///workspace/schemas/work-management/content/milestone.json'
        ),
      })
    );
  });

  it('$templ-schema still takes precedence over $schema alias', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/templates/page.md.tpl'),
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

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/templ-specific.json'),
      'utf-8'
    );
    expect(readFileSync).not.toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/generic.json'),
      'utf-8'
    );
  });

  // ── Schema load logging ───────────────────────────────────────────────────

  it('logs successful schema file loads to connection.console.log', async () => {
    await import('../src/server');
    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        schemaPath: '.templjs/schema.json',
        contentSchemaPath: '.templjs/content.json',
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/templates/page.md.tpl'),
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
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {},
    });

    readFileSync.mockClear();

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;

    vi.useFakeTimers();
    openHandler({
      textDocument: {
        uri: toTestWorkspaceUri('file:///workspace/templates/project.md.tpl'),
        languageId: 'templjs-markdown',
        version: 1,
        text: ['---', '"$schema": schemas/project.json', '---', '{{ narrative }}'].join('\n'),
      },
    });

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/project.json'),
      'utf-8'
    );
  });

  it('per-document reload also picks up $content_schema from newly opened document', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {},
    });

    readFileSync.mockClear();

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;

    vi.useFakeTimers();
    openHandler({
      textDocument: {
        uri: toTestWorkspaceUri('file:///workspace/templates/record.md.tpl'),
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

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/fm/record.json'),
      'utf-8'
    );
    expect(readFileSync).toHaveBeenCalledWith(
      toTestWorkspacePath('/workspace/schemas/content/record.json'),
      'utf-8'
    );
  });

  it('logs and clears diagnostics when diagnostic collection throws', async () => {
    collectDiagnostics.mockImplementationOnce(() => {
      throw new Error('diagnostics exploded');
    });

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;

    vi.useFakeTimers();
    openHandler({
      textDocument: {
        uri: toTestWorkspaceUri('file:///workspace/diag-fail.md.tpl'),
        languageId: 'templjs-markdown',
        version: 1,
        text: '{{ user.name }}',
      },
    });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        `Diagnostics skipped for ${toTestWorkspaceUri('file:///workspace/diag-fail.md.tpl')}: diagnostics exploded`
      )
    );
    expect(sendDiagnostics).toHaveBeenCalledWith({
      uri: toTestWorkspaceUri('file:///workspace/diag-fail.md.tpl'),
      diagnostics: [],
    });
  });

  it('defaults diagnostic source to templjs when diagnostics omit it', async () => {
    collectDiagnostics.mockReturnValueOnce([
      {
        message: 'missing field',
        severity: 1,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 4 },
        },
        source: undefined,
        code: 'missing-field',
      },
    ]);

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;

    openHandler({
      textDocument: {
        uri: toTestWorkspaceUri('file:///workspace/default-source.md.tpl'),
        languageId: 'templjs-markdown',
        version: 1,
        text: '{{ value }}',
      },
    });

    await vi.waitFor(() => {
      expect(sendDiagnostics).toHaveBeenCalledWith({
        uri: toTestWorkspaceUri('file:///workspace/default-source.md.tpl'),
        diagnostics: [
          {
            message: 'missing field',
            severity: 1,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 4 },
            },
            source: 'templjs',
            code: 'missing-field',
          },
        ],
      });
    });
  });

  it('publishes templjs and host markdown diagnostics together on change', async () => {
    const hostValidation = vi.fn(async () => [
      {
        message: 'Host markdown diagnostic',
        severity: 2,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 3 },
        },
        source: 'markdown',
        code: 'md.host',
      },
    ]);

    getProject.mockResolvedValue({
      getLanguageService: () => ({ doValidation: hostValidation }),
    });

    collectDiagnostics.mockReturnValue([
      {
        message: 'Templ diagnostic',
        severity: 1,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 4 },
        },
        source: 'templjs',
        code: 'templjs.undefinedVariable',
      },
    ]);

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({ rootUri: toTestWorkspaceUri('file:///workspace') });

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text: string; languageId: string; version: number };
    }) => void;
    const changeHandler = onDidChangeTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      contentChanges: Array<{ text: string }>;
    }) => void;

    const docUri = toTestWorkspaceUri('file:///workspace/host-diags.md.tmpl');
    openHandler({
      textDocument: {
        uri: docUri,
        languageId: 'templjs-markdown',
        version: 1,
        text: '{{ value }}',
      },
    });

    sendDiagnostics.mockClear();

    changeHandler({
      textDocument: { uri: docUri },
      contentChanges: [{ text: '{{ value }}\n#bad-heading' }],
    });

    await vi.waitFor(() => {
      expect(sendDiagnostics).toHaveBeenCalled();
    });

    const lastPayload = sendDiagnostics.mock.calls.at(-1)?.[0] as {
      uri: string;
      diagnostics: Array<{ source?: string; message: string }>;
    };
    expect(lastPayload?.uri).toBe(docUri);
    expect(lastPayload.diagnostics.some((diag) => diag.source === 'templjs')).toBe(true);
    expect(lastPayload.diagnostics.some((diag) => diag.source === 'markdown')).toBe(true);
    expect(hostValidation).toHaveBeenCalledWith(docUri);
  });

  it('drops stale schema reload generations when a newer change is queued', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/stale.md.tpl'),
          content: '{{ user.name }}',
        },
      },
    });

    sendDiagnostics.mockClear();
    collectDiagnostics.mockReturnValue([]);

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

    vi.useFakeTimers();
    try {
      changeHandler({
        textDocument: { uri: toTestWorkspaceUri('file:///workspace/stale.md.tpl') },
        contentChanges: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            text: '{{# schema: a.json }}\n',
          },
        ],
      });

      changeHandler({
        textDocument: { uri: toTestWorkspaceUri('file:///workspace/stale.md.tpl') },
        contentChanges: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            text: '{{# schema: b.json }}\n',
          },
        ],
      });

      await vi.runAllTimersAsync();
      await Promise.resolve();

      // Stale a.json generation should be dropped; only the newest generation may publish
      // (once for local diagnostics and once after extended diagnostics complete).
      expect(sendDiagnostics.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(sendDiagnostics.mock.calls.length).toBeLessThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores watched-file events when no schema-like files changed', async () => {
    await import('../src/server');

    const watchedFilesHandler = onDidChangeWatchedFiles.mock.calls[0][0] as (event: {
      changes: Array<{ uri: string; type: number }>;
    }) => void;

    sendDiagnostics.mockClear();
    consoleLog.mockClear();

    watchedFilesHandler({
      changes: [
        { uri: toTestWorkspaceUri('file:///workspace/readme.txt'), type: FILE_CHANGE_TYPE_CHANGED },
      ],
    });

    expect(sendDiagnostics).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalledWith(
      expect.stringContaining('schema-like file change detected')
    );
  });

  it('treats missing watched-file changes as a no-op', async () => {
    await import('../src/server');

    const watchedFilesHandler = onDidChangeWatchedFiles.mock.calls[0][0] as (event: {
      changes?: Array<{ uri: string; type: number }>;
    }) => void;

    sendDiagnostics.mockClear();
    consoleLog.mockClear();

    watchedFilesHandler({});

    expect(sendDiagnostics).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalledWith(
      expect.stringContaining('schema-like file change detected')
    );
  });

  it('re-runs diagnostics without reloading schemas when schema references are unchanged', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {
        documentContext: {
          uri: toTestWorkspaceUri('file:///workspace/unchanged-schema.md.tpl'),
          content: '---\n$schema: ./schema.json\n---\n{{ value }}',
        },
      },
    });

    readFileSync.mockClear();
    sendDiagnostics.mockClear();

    const changeHandler = onDidChangeTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      contentChanges: Array<{ text: string }>;
    }) => void;

    changeHandler({
      textDocument: { uri: toTestWorkspaceUri('file:///workspace/unchanged-schema.md.tpl') },
      contentChanges: [{ text: '---\n$schema: ./schema.json\n---\n{{ seeded }}' }],
    });

    await Promise.resolve();

    readFileSync.mockClear();
    sendDiagnostics.mockClear();

    changeHandler({
      textDocument: { uri: toTestWorkspaceUri('file:///workspace/unchanged-schema.md.tpl') },
      contentChanges: [{ text: '---\n$schema: ./schema.json\n---\n{{ updated }}' }],
    });

    expect(readFileSync).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(sendDiagnostics.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('skips diagnostics publishing when an opened document has undefined text', async () => {
    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({
      rootUri: toTestWorkspaceUri('file:///workspace'),
      initializationOptions: {},
    });

    const openHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
      textDocument: { uri: string; text?: string; languageId: string; version: number };
    }) => void;

    sendDiagnostics.mockClear();

    openHandler({
      textDocument: {
        uri: toTestWorkspaceUri('file:///workspace/undefined-open.md.tpl'),
        languageId: 'templjs-markdown',
        version: 1,
        text: undefined,
      },
    });

    await Promise.resolve();

    expect(sendDiagnostics).not.toHaveBeenCalled();
  });

  it('traces schema load failures for document changes', async () => {
    let loadCount = 0;

    vi.doMock('../src/schema-loading.js', async () => {
      const real = await vi.importActual<typeof import('../src/schema-loading.js')>(
        '../src/schema-loading.js'
      );
      return {
        ...real,
        loadSchemaSource: vi.fn(async (...args: Parameters<typeof real.loadSchemaSource>) => {
          loadCount += 1;
          if (loadCount > 1) {
            throw new Error('change load exploded');
          }
          return real.loadSchemaSource(...args);
        }),
      };
    });

    try {
      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (
        params: unknown
      ) => Promise<unknown>;
      await initializeHandler({
        rootUri: toTestWorkspaceUri('file:///workspace'),
        initializationOptions: {
          traceMode: 'messages',
          documentContext: {
            uri: toTestWorkspaceUri('file:///workspace/change-failure.md.tpl'),
            content: '---\n$schema: ./schema-a.json\n---\n{{ value }}',
          },
        },
      });

      consoleLog.mockClear();

      const changeHandler = onDidChangeTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        contentChanges: Array<{ text: string }>;
      }) => void;

      changeHandler({
        textDocument: { uri: toTestWorkspaceUri('file:///workspace/change-failure.md.tpl') },
        contentChanges: [{ text: '---\n$schema: ./schema-b.json\n---\n{{ value }}' }],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          `Schema resolution for ${toTestWorkspaceUri('file:///workspace/change-failure.md.tpl')}`
        )
      );
    } finally {
      vi.doUnmock('../src/schema-loading.js');
    }
  });

  it('drops stale watched-file reload generations when a newer reload is queued', async () => {
    let resolveFirstLoad: (() => void) | undefined;
    const firstLoad = new Promise<void>((resolve) => {
      resolveFirstLoad = resolve;
    });
    let loadCount = 0;

    vi.doMock('../src/schema-loading.js', async () => {
      const real = await vi.importActual<typeof import('../src/schema-loading.js')>(
        '../src/schema-loading.js'
      );
      return {
        ...real,
        loadSchemaSource: vi.fn(async (...args: Parameters<typeof real.loadSchemaSource>) => {
          loadCount += 1;
          if (loadCount === 2) {
            await firstLoad;
          }
          return real.loadSchemaSource(...args);
        }),
      };
    });

    try {
      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (
        params: unknown
      ) => Promise<unknown>;
      await initializeHandler({
        rootUri: toTestWorkspaceUri('file:///workspace'),
        initializationOptions: {
          documentContext: {
            uri: toTestWorkspaceUri('file:///workspace/watched-stale.md.tpl'),
            content: '---\n$schema: ./schema.json\n---\n{{ value }}',
          },
        },
      });

      const watchedFilesHandler = onDidChangeWatchedFiles.mock.calls[0][0] as (event: {
        changes: Array<{ uri: string; type: number }>;
      }) => void;

      sendDiagnostics.mockClear();

      watchedFilesHandler({
        changes: [
          {
            uri: toTestWorkspaceUri('file:///workspace/schema.json'),
            type: FILE_CHANGE_TYPE_CHANGED,
          },
        ],
      });

      watchedFilesHandler({
        changes: [
          {
            uri: toTestWorkspaceUri('file:///workspace/schema.json'),
            type: FILE_CHANGE_TYPE_CHANGED,
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      resolveFirstLoad?.();

      await vi.waitFor(() => {
        expect(sendDiagnostics.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    } finally {
      vi.doUnmock('../src/schema-loading.js');
    }
  });

  it('traces schema reload failures for watched schema changes', async () => {
    let loadCount = 0;

    vi.doMock('../src/schema-loading.js', async () => {
      const real = await vi.importActual<typeof import('../src/schema-loading.js')>(
        '../src/schema-loading.js'
      );
      return {
        ...real,
        loadSchemaSource: vi.fn(async (...args: Parameters<typeof real.loadSchemaSource>) => {
          loadCount += 1;
          if (loadCount > 1) {
            throw new Error('watch reload exploded');
          }
          return real.loadSchemaSource(...args);
        }),
      };
    });

    try {
      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (
        params: unknown
      ) => Promise<unknown>;
      await initializeHandler({
        rootUri: toTestWorkspaceUri('file:///workspace'),
        initializationOptions: {
          traceMode: 'messages',
          documentContext: {
            uri: toTestWorkspaceUri('file:///workspace/watch-failure.md.tpl'),
            content: '---\n$schema: ./schema.json\n---\n{{ value }}',
          },
        },
      });

      consoleLog.mockClear();

      const watchedFilesHandler = onDidChangeWatchedFiles.mock.calls[0][0] as (event: {
        changes: Array<{ uri: string; type: number }>;
      }) => void;

      watchedFilesHandler({
        changes: [
          {
            uri: toTestWorkspaceUri('file:///workspace/schema.json'),
            type: FILE_CHANGE_TYPE_CHANGED,
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        consoleLog.mock.calls.some(
          ([message]) =>
            typeof message === 'string' &&
            message
              .toLowerCase()
              .includes(
                `schema reload failed for ${toTestWorkspaceUri('file:///workspace/watch-failure.md.tpl')}`.toLowerCase()
              )
        )
      ).toBe(true);
    } finally {
      vi.doUnmock('../src/schema-loading.js');
    }
  });
});

// ---------------------------------------------------------------------------
// Pure-function unit tests - no mock infrastructure needed
// ---------------------------------------------------------------------------

describe('isMdTemplateUri', () => {
  let isMdTemplateUri: (uri: string) => boolean;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/server');
    isMdTemplateUri = mod.isMdTemplateUri;
  });

  it('returns true for .md.templ URIs', () => {
    expect(isMdTemplateUri('file:///workspace/doc.md.templ')).toBe(true);
  });

  it('returns true for .md.tmpl and .md.tpl URIs', () => {
    expect(isMdTemplateUri('file:///a.md.tmpl')).toBe(true);
    expect(isMdTemplateUri('file:///a.md.tpl')).toBe(true);
  });

  it('returns false for non-template markdown URIs', () => {
    expect(isMdTemplateUri('file:///doc.md')).toBe(false);
  });

  it('returns false for non-markdown template URIs', () => {
    expect(isMdTemplateUri('file:///doc.html.templ')).toBe(false);
  });
});
