import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import schemaLoading, {
  DEFAULT_SCHEMA_LOAD_TIMEOUT_MS,
  extractDocumentSchemaKey,
  findSchemaConfigForDocument,
  loadSchemaSource,
  loadSchemaSourceSync,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
} from '../src/schema-loading';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'templjs-vscode-schema-loading-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('schema-loading', () => {
  it('exports helper functions and resolves workspace roots', () => {
    const workspaceRoot = path.join(tmpdir(), 'templjs-schema-workspace');

    expect(schemaLoading.DEFAULT_SCHEMA_LOAD_TIMEOUT_MS).toBe(DEFAULT_SCHEMA_LOAD_TIMEOUT_MS);
    expect(schemaLoading.extractDocumentSchemaKey).toBe(extractDocumentSchemaKey);
    expect(schemaLoading.findSchemaConfigForDocument).toBe(findSchemaConfigForDocument);
    expect(schemaLoading.loadSchemaSource).toBe(loadSchemaSource);
    expect(schemaLoading.loadSchemaSourceSync).toBe(loadSchemaSourceSync);
    expect(schemaLoading.resolveDocumentSchemaSources).toBe(resolveDocumentSchemaSources);
    expect(schemaLoading.resolveWorkspaceRoot).toBe(resolveWorkspaceRoot);

    expect(
      resolveWorkspaceRoot({
        workspaceFolders: [{ uri: pathToFileURL(workspaceRoot).toString() }],
        rootUri: 'file:///fallback',
      })
    ).toBe(workspaceRoot);
    expect(resolveWorkspaceRoot({ rootUri: 'untitled:workspace' })).toBe('untitled:workspace');
    expect(resolveWorkspaceRoot({ rootUri: null })).toBeUndefined();
  });

  it('matches schema pattern configurations for document paths', () => {
    const backlogConfig = {
      schemaPath: '.templjs/frontmatter.json',
      contentSchemaPath: '.templjs/content.json',
    };

    expect(
      findSchemaConfigForDocument('backlog/.hidden/item.md.templ', {
        'backlog/**': backlogConfig,
      })
    ).toEqual(backlogConfig);
    expect(
      findSchemaConfigForDocument('docs/page.md.templ', {
        'backlog/**': backlogConfig,
      })
    ).toBeUndefined();
    expect(findSchemaConfigForDocument(undefined, { 'backlog/**': backlogConfig })).toBeUndefined();
    expect(findSchemaConfigForDocument('backlog/item.md.templ', undefined)).toBeUndefined();
  });

  it('loads local schema fragments and dereferences nested file refs', async () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, '.templjs', 'frontmatter.json');
    const commonPath = path.join(tempDir, '.templjs', 'common.json');
    const documentPath = path.join(tempDir, 'backlog', 'item.md.templ');

    writeJson(commonPath, {
      $defs: {
        base: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            shared: { type: 'string' },
          },
          required: ['slug'],
        },
      },
    });
    writeJson(schemaPath, {
      $defs: {
        relationship: {
          $ref: './common.json#/$defs/base',
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
          required: ['title'],
        },
      },
    });
    mkdirSync(path.dirname(documentPath), { recursive: true });
    writeFileSync(documentPath, 'body');

    await expect(
      loadSchemaSource(
        '.templjs/frontmatter.json#/$defs/relationship',
        tempDir,
        pathToFileURL(documentPath).toString()
      )
    ).resolves.toEqual({
      schema: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          shared: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['slug', 'title'],
      },
      schemaUri: pathToFileURL(schemaPath).toString(),
    });
  });

  it('returns empty results for missing local schema fragments or unresolved paths', async () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, '.templjs', 'frontmatter.json');
    const log = vi.fn();

    writeJson(schemaPath, {
      $defs: {
        item: {
          type: 'object',
        },
      },
    });

    await expect(
      loadSchemaSource('.templjs/frontmatter.json#/$defs/missing', tempDir, undefined, { log })
    ).resolves.toEqual({});
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`Schema fragment not found in file '${schemaPath}#/$defs/missing'`)
    );

    log.mockClear();

    await expect(
      loadSchemaSource('./missing.json', undefined, undefined, { log })
    ).resolves.toEqual({});
    expect(log).toHaveBeenCalledWith(
      "[templjs] Could not resolve schema path './missing.json' (no workspace root?)"
    );
  });

  it('handles missing fetch implementations and abort-like HTTP failures', async () => {
    const url = 'https://schemas.example.com/work-item.json';

    vi.stubGlobal('fetch', undefined);
    const missingFetchLog = vi.fn();
    await expect(
      loadSchemaSource(url, undefined, undefined, { log: missingFetchLog })
    ).resolves.toEqual({});
    expect(missingFetchLog).toHaveBeenCalledWith(
      `[templjs] No fetch implementation available for schema URL '${url}'`
    );

    const timeoutLog = vi.fn();
    const timeoutError = new Error('aborted');
    timeoutError.name = 'AbortError';
    const fetchImpl = vi.fn(async () => {
      throw timeoutError;
    });

    await expect(
      loadSchemaSource(url, undefined, undefined, {
        fetchImpl: fetchImpl as typeof fetch,
        log: timeoutLog,
        timeoutMs: 12,
      })
    ).resolves.toEqual({});
    expect(timeoutLog).toHaveBeenCalledWith(
      `[templjs] Timeout loading schema from URL '${url}' after 12ms`
    );
  });

  it('aborts HTTP schema loads when the timeout elapses', async () => {
    const url = 'https://schemas.example.com/slow-schema.json';
    const timeoutLog = vi.fn();
    const fetchImpl = vi.fn(
      (_input: string, init?: { signal?: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true }
          );
        })
    );

    await expect(
      loadSchemaSource(url, undefined, undefined, {
        fetchImpl: fetchImpl as typeof fetch,
        log: timeoutLog,
        timeoutMs: 1,
      })
    ).resolves.toEqual({});
    expect(timeoutLog).toHaveBeenCalledWith(
      `[templjs] Timeout loading schema from URL '${url}' after 1ms`
    );
  });

  it('loads schema fragments from HTTP sources', async () => {
    const url = 'https://schemas.example.com/work-item.json#/$defs/item';
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          $defs: {
            item: {
              type: 'object',
              properties: {
                owner: { type: 'string' },
              },
            },
          },
        }),
    }));

    await expect(
      loadSchemaSource(url, undefined, undefined, {
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).resolves.toEqual({
      schema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
        },
      },
      schemaUri: 'https://schemas.example.com/work-item.json',
    });
  });

  it('returns empty for unsupported fragment syntax and scalar fragment targets', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ foo: { value: 1 }, scalar: 'text' }),
    }));

    await expect(
      loadSchemaSource(
        'https://schemas.example.com/work-item.json#invalid-fragment',
        undefined,
        undefined,
        {
          fetchImpl: fetchImpl as typeof fetch,
        }
      )
    ).resolves.toEqual({});

    await expect(
      loadSchemaSource('https://schemas.example.com/work-item.json#/scalar', undefined, undefined, {
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).resolves.toEqual({});
  });

  it('handles HTTP fetch failures and malformed responses', async () => {
    const log = vi.fn();

    await expect(
      loadSchemaSource('https://schemas.example.com/work-item.json', undefined, undefined, {
        fetchImpl: (async () => {
          throw new Error('socket hang up');
        }) as unknown as typeof fetch,
        log,
      })
    ).resolves.toEqual({});
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error loading schema from URL 'https://schemas.example.com/work-item.json': socket hang up"
      )
    );
  });

  it('dereferences circular and missing local refs without crashing', async () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, '.templjs', 'circular.json');

    writeJson(schemaPath, {
      $defs: {
        cyc: {
          type: 'object',
          $ref: '#/$defs/cyc',
          properties: {
            id: { type: 'string' },
          },
        },
        missingRef: {
          $ref: './missing.json#/$defs/shape',
          type: 'object',
          properties: {
            fallback: { type: 'string' },
          },
        },
      },
    });

    await expect(loadSchemaSource('.templjs/circular.json#/$defs/cyc', tempDir)).resolves.toEqual(
      expect.objectContaining({
        schema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({ id: { type: 'string' } }),
        }),
      })
    );

    await expect(
      loadSchemaSource('.templjs/circular.json#/$defs/missingRef', tempDir)
    ).resolves.toEqual(
      expect.objectContaining({
        schema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({ fallback: { type: 'string' } }),
        }),
      })
    );
  });

  it('loads schema sources synchronously for local files and ignores unsupported sources', () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, '.templjs', 'frontmatter.json');

    writeJson(schemaPath, {
      $defs: {
        item: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
      },
    });

    expect(
      loadSchemaSourceSync(`${pathToFileURL(schemaPath).toString()}#/$defs/item`, tempDir)
    ).toEqual({
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      },
      schemaUri: pathToFileURL(schemaPath).toString(),
    });
    expect(loadSchemaSourceSync('https://schemas.example.com/schema.json', tempDir)).toEqual({});
    expect(loadSchemaSourceSync('.templjs/frontmatter.json#/$defs/missing', tempDir)).toEqual({});
  });

  it('extracts schema keys from inline directives and JSON root objects', () => {
    const inlineContent = [
      '---',
      '$schema: .templjs/root-frontmatter.json',
      '$content_schema: .templjs/root-content.json',
      '---',
      '{{# schema: .templjs/inline-frontmatter.json }}',
      '{{# content-schema: .templjs/inline-content.json }}',
    ].join('\n');

    expect(extractDocumentSchemaKey(inlineContent)).toBe(
      '.templjs/inline-frontmatter.json\0.templjs/inline-content.json'
    );
    expect(
      extractDocumentSchemaKey(
        JSON.stringify({
          $schema: ' .templjs/root-object-frontmatter.json ',
          $content_schema: ' .templjs/root-object-content.json ',
        })
      )
    ).toBe('.templjs/root-object-frontmatter.json\0.templjs/root-object-content.json');
  });

  it('resolves document schema sources with inline, root, and pattern precedence', () => {
    const tempDir = makeTempDir();
    const workspaceUri = pathToFileURL(tempDir).toString();
    const documentUri = pathToFileURL(path.join(tempDir, 'backlog', 'item.md.templ')).toString();

    const inlineContent = [
      '---',
      '$schema: .templjs/root-frontmatter.json',
      '$content_schema: .templjs/root-content.json',
      '---',
      '{{# schema: .templjs/inline-frontmatter.json }}',
      '{{# content-schema: .templjs/inline-content.json }}',
    ].join('\n');

    expect(
      resolveDocumentSchemaSources({
        workspaceFolders: [{ uri: workspaceUri }],
        initializationOptions: {
          schemaPath: '.templjs/default-frontmatter.json',
          contentSchemaPath: '.templjs/default-content.json',
          schemaPatterns: {
            'backlog/**': {
              schemaPath: '.templjs/pattern-frontmatter.json',
              contentSchemaPath: '.templjs/pattern-content.json',
            },
          },
          documentContext: {
            uri: documentUri,
            content: inlineContent,
          },
        },
      })
    ).toEqual({
      schemaPath: '.templjs/inline-frontmatter.json',
      contentSchemaPath: '.templjs/inline-content.json',
    });

    expect(
      resolveDocumentSchemaSources({
        workspaceFolders: [{ uri: workspaceUri }],
        initializationOptions: {
          schemaPath: '.templjs/default-frontmatter.json',
          contentSchemaPath: '.templjs/default-content.json',
          schemaPatterns: {
            'backlog/**': {
              schemaPath: '.templjs/pattern-frontmatter.json',
              contentSchemaPath: '.templjs/pattern-content.json',
            },
          },
          documentContext: {
            uri: documentUri,
            content: '',
          },
        },
      })
    ).toEqual({
      schemaPath: '.templjs/pattern-frontmatter.json',
      contentSchemaPath: '.templjs/pattern-content.json',
    });
  });
});
