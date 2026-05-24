import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';

type SchemaLoadingApi = {
  schemaLoading: {
    DEFAULT_SCHEMA_LOAD_TIMEOUT_MS: number;
    extractDocumentSchemaKey: typeof import('../src/index.ts').extractDocumentSchemaKey;
    findSchemaConfigForDocument: typeof import('../src/index.ts').findSchemaConfigForDocument;
    loadSchemaSource: typeof import('../src/index.ts').loadSchemaSource;
    loadSchemaSourceSync: typeof import('../src/index.ts').loadSchemaSourceSync;
    resolveDocumentSchemaSources: typeof import('../src/index.ts').resolveDocumentSchemaSources;
    resolveWorkspaceRoot: typeof import('../src/index.ts').resolveWorkspaceRoot;
  };
  DEFAULT_SCHEMA_LOAD_TIMEOUT_MS: typeof import('../src/index.ts').DEFAULT_SCHEMA_LOAD_TIMEOUT_MS;
  extractDocumentSchemaKey: typeof import('../src/index.ts').extractDocumentSchemaKey;
  findSchemaConfigForDocument: typeof import('../src/index.ts').findSchemaConfigForDocument;
  loadSchemaSource: typeof import('../src/index.ts').loadSchemaSource;
  loadSchemaSourceSync: typeof import('../src/index.ts').loadSchemaSourceSync;
  resolveDocumentSchemaSources: typeof import('../src/index.ts').resolveDocumentSchemaSources;
  resolveWorkspaceRoot: typeof import('../src/index.ts').resolveWorkspaceRoot;
};

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'templjs-schema-loading-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function registerSchemaLoadingSuite({
  schemaLoading,
  DEFAULT_SCHEMA_LOAD_TIMEOUT_MS,
  extractDocumentSchemaKey,
  findSchemaConfigForDocument,
  loadSchemaSource,
  loadSchemaSourceSync,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
}: SchemaLoadingApi): void {
  describe('schema-loading', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();

      for (const tempDir of tempDirs.splice(0)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

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
      expect(
        findSchemaConfigForDocument(undefined, { 'backlog/**': backlogConfig })
      ).toBeUndefined();
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

    it('reuses cached HTTP schema content across repeated loads', async () => {
      const cache = new Map<string, unknown>();
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            $defs: {
              owner: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          }),
      }));

      await expect(
        loadSchemaSource(
          'https://schemas.example.com/work-item.json#/$defs/owner',
          undefined,
          undefined,
          {
            fetchImpl: fetchImpl as typeof fetch,
            cache,
          }
        )
      ).resolves.toEqual({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        schemaUri: 'https://schemas.example.com/work-item.json',
      });

      await expect(
        loadSchemaSource(
          'https://schemas.example.com/work-item.json#/$defs/meta',
          undefined,
          undefined,
          {
            fetchImpl: fetchImpl as typeof fetch,
            cache,
          }
        )
      ).resolves.toEqual({
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        schemaUri: 'https://schemas.example.com/work-item.json',
      });

      expect(fetchImpl).toHaveBeenCalledTimes(1);
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
        loadSchemaSource(
          'https://schemas.example.com/work-item.json#/scalar',
          undefined,
          undefined,
          {
            fetchImpl: fetchImpl as typeof fetch,
          }
        )
      ).resolves.toEqual({});
    });

    it('preserves unresolved remote sibling refs instead of stripping them', async () => {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            $defs: {
              item: {
                $ref: './common.json#/$defs/base',
                type: 'object',
                properties: {
                  title: { type: 'string' },
                },
              },
            },
          }),
      }));

      await expect(
        loadSchemaSource(
          'https://schemas.example.com/work-item.json#/$defs/item',
          undefined,
          undefined,
          {
            fetchImpl: fetchImpl as typeof fetch,
          }
        )
      ).resolves.toEqual({
        schema: {
          $ref: './common.json#/$defs/base',
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
        schemaUri: 'https://schemas.example.com/work-item.json',
      });
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

    it('returns empty and logs for non-OK HTTP responses', async () => {
      const log = vi.fn();
      const fetchImpl = vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => 'not found',
      }));

      await expect(
        loadSchemaSource('https://schemas.example.com/missing.json', undefined, undefined, {
          fetchImpl: fetchImpl as typeof fetch,
          log,
        })
      ).resolves.toEqual({});

      expect(log).toHaveBeenCalledWith(
        "[templjs] Failed to load schema from URL 'https://schemas.example.com/missing.json': HTTP 404"
      );
    });

    it('returns empty and logs when no fetch implementation is available', async () => {
      const log = vi.fn();
      vi.stubGlobal('fetch', undefined);

      await expect(
        loadSchemaSource('https://schemas.example.com/no-fetch.json', undefined, undefined, {
          log,
        })
      ).resolves.toEqual({});

      expect(log).toHaveBeenCalledWith(
        "[templjs] No fetch implementation available for schema URL 'https://schemas.example.com/no-fetch.json'"
      );
    });

    it('returns empty and logs when cached URL schema processing throws', async () => {
      const url = 'https://schemas.example.com/cached.json';
      const cache = new Map<string, unknown>();
      const log = vi.fn();
      const fetchImpl = vi.fn();

      const problematicSchema = {} as Record<string, unknown>;
      Object.defineProperty(problematicSchema, '$ref', {
        enumerable: true,
        get() {
          throw new Error('explosive-ref');
        },
      });

      cache.set(url, problematicSchema);

      await expect(
        loadSchemaSource(url, undefined, undefined, {
          cache,
          log,
          fetchImpl: fetchImpl as unknown as typeof fetch,
        })
      ).resolves.toEqual({});

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(
          "Error processing schema from URL 'https://schemas.example.com/cached.json': explosive-ref"
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

    it('falls back when referenced local schema files are malformed or resolve to scalars', async () => {
      const tempDir = makeTempDir();
      const brokenRefPath = path.join(tempDir, '.templjs', 'broken-ref.json');
      const brokenTargetPath = path.join(tempDir, '.templjs', 'broken-target.json');
      const scalarRefPath = path.join(tempDir, '.templjs', 'scalar-ref.json');
      const scalarTargetPath = path.join(tempDir, '.templjs', 'scalar-target.json');

      writeJson(scalarTargetPath, {
        $defs: {
          flag: true,
        },
      });
      writeJson(brokenRefPath, {
        $defs: {
          item: {
            $ref: './broken-target.json#/$defs/item',
            type: 'object',
            properties: {
              fallback: { type: 'string' },
            },
          },
        },
      });
      writeJson(scalarRefPath, {
        $defs: {
          item: {
            $ref: './scalar-target.json#/$defs/flag',
            type: 'string',
          },
        },
      });
      mkdirSync(path.dirname(brokenTargetPath), { recursive: true });
      writeFileSync(brokenTargetPath, '{"$defs":', 'utf8');

      await expect(loadSchemaSource(`${brokenRefPath}#/$defs/item`, tempDir)).resolves.toEqual({
        schema: {
          type: 'object',
          properties: {
            fallback: { type: 'string' },
          },
        },
        schemaUri: pathToFileURL(brokenRefPath).toString(),
      });

      await expect(loadSchemaSource(`${scalarRefPath}#/$defs/item`, tempDir)).resolves.toEqual({
        schema: {
          type: 'string',
        },
        schemaUri: pathToFileURL(scalarRefPath).toString(),
      });
    });

    it('loads schema sources synchronously for local files and URL sources when cached', () => {
      const tempDir = makeTempDir();
      const schemaPath = path.join(tempDir, '.templjs', 'frontmatter.json');
      const remoteSchemaUrl = 'https://schemas.example.com/schema.json';
      const cache = new Map<string, unknown>([
        [
          remoteSchemaUrl,
          {
            $defs: {
              remote: {
                type: 'object',
                properties: {
                  owner: { type: 'string' },
                },
              },
            },
          },
        ],
      ]);

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
      expect(
        loadSchemaSourceSync(`${remoteSchemaUrl}#/$defs/remote`, tempDir, undefined, { cache })
      ).toEqual({
        schema: {
          type: 'object',
          properties: {
            owner: { type: 'string' },
          },
        },
        schemaUri: remoteSchemaUrl,
      });
      expect(loadSchemaSourceSync('.templjs/frontmatter.json#/$defs/missing', tempDir)).toEqual({});
    });

    it('reuses cached local schema content across repeated sync loads', () => {
      const tempDir = makeTempDir();
      const schemaPath = path.join(tempDir, '.templjs', 'frontmatter.json');
      const schemaUrl = pathToFileURL(schemaPath).toString();
      const cache = new Map<string, unknown>();

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
        loadSchemaSourceSync(`${schemaUrl}#/$defs/item`, tempDir, undefined, { cache })
      ).toEqual({
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
        schemaUri: schemaUrl,
      });

      writeFileSync(schemaPath, '{"$defs":', 'utf8');

      expect(
        loadSchemaSourceSync(`${schemaUrl}#/$defs/item`, tempDir, undefined, { cache })
      ).toEqual({
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
        schemaUri: schemaUrl,
      });
    });

    it('loads URL schema sources synchronously via sync URL loader when cache is cold', () => {
      const url = 'https://schemas.example.com/work-item.json#/$defs/item';
      const loadUrlSync = vi.fn(() =>
        JSON.stringify({
          $defs: {
            item: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        })
      );

      expect(loadSchemaSourceSync(url, undefined, undefined, { loadUrlSync })).toEqual({
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        schemaUri: 'https://schemas.example.com/work-item.json',
      });
      expect(loadUrlSync).toHaveBeenCalledWith('https://schemas.example.com/work-item.json');
    });

    it('returns empty for synchronously loaded malformed JSON schema files', () => {
      const tempDir = makeTempDir();
      const schemaPath = path.join(tempDir, '.templjs', 'broken.json');
      mkdirSync(path.dirname(schemaPath), { recursive: true });
      writeFileSync(schemaPath, '{"type":', 'utf-8');

      expect(loadSchemaSourceSync('.templjs/broken.json', tempDir)).toEqual({});
    });

    it('extracts schema keys from inline directives and JSON root objects', () => {
      const inlineContent = [
        '---',
        '$schema: .templjs/root-frontmatter.json',
        '$content-schema: .templjs/root-content.json',
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
            '$content-schema': ' .templjs/root-object-content.json ',
          })
        )
      ).toBe('.templjs/root-object-frontmatter.json\0.templjs/root-object-content.json');
    });

    it('uses the first inline schema directive when multiple directives are present', () => {
      const inlineContent = [
        '{{# schema: .templjs/first-inline-frontmatter.json }}',
        '{{# schema: .templjs/second-inline-frontmatter.json }}',
        '{{# content-schema: .templjs/first-inline-content.json }}',
        '{{# content-schema: .templjs/second-inline-content.json }}',
      ].join('\n');

      expect(extractDocumentSchemaKey(inlineContent)).toBe(
        '.templjs/first-inline-frontmatter.json\0.templjs/first-inline-content.json'
      );
    });

    it('resolves document schema sources with inline, root, and pattern precedence', () => {
      const tempDir = makeTempDir();
      const workspaceUri = pathToFileURL(tempDir).toString();
      const documentUri = pathToFileURL(path.join(tempDir, 'backlog', 'item.md.templ')).toString();

      const inlineContent = [
        '---',
        '$schema: .templjs/root-frontmatter.json',
        '$content-schema: .templjs/root-content.json',
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

    it('falls back to default settings when document URI cannot be normalized', () => {
      const tempDir = makeTempDir();
      const workspaceUri = pathToFileURL(tempDir).toString();

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
              uri: 'file://%zz',
              content: '',
            },
          },
        })
      ).toEqual({
        schemaPath: '.templjs/default-frontmatter.json',
        contentSchemaPath: '.templjs/default-content.json',
      });
    });

    it('returns undefined for invalid file workspace URIs', () => {
      expect(
        resolveWorkspaceRoot({
          workspaceFolders: [{ uri: 'file:///%E0%A4%A' }],
        })
      ).toBeUndefined();
    });

    it('prefers the workspace folder containing the current document in multi-root workspaces', () => {
      const rootWorkspace = path.join(tmpdir(), 'templjs-root-workspace');
      const nestedWorkspace = path.join(rootWorkspace, 'packages', 'feature');

      expect(
        resolveWorkspaceRoot({
          rootUri: pathToFileURL(rootWorkspace).toString(),
          workspaceFolders: [
            { uri: pathToFileURL(rootWorkspace).toString() },
            { uri: pathToFileURL(nestedWorkspace).toString() },
          ],
          initializationOptions: {
            documentContext: {
              uri: pathToFileURL(path.join(nestedWorkspace, 'docs', 'item.md.templ')).toString(),
              content: '',
            },
          },
        })
      ).toBe(nestedWorkspace);
    });
  });
}
