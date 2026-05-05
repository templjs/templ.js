import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

vi.mock('../../../extensions/vscode/src/schema-loading', async () => {
  const actual = await import('../src/index.ts');
  return {
    ...actual,
    default: actual.schemaLoading,
  };
});

import '../../../extensions/vscode/test/schema-loading.test.ts';

import { describe, expect, it, vi } from 'vitest';
import {
  extractDocumentSchemaKey,
  loadSchemaSource,
  loadSchemaSourceSync,
  resolveDocumentSchemaSources,
} from '../src/index.ts';

describe('language-service schema-loading coverage branches', () => {
  it('prefers inline directives over root and settings schemas', () => {
    const params = {
      rootUri: 'file:///workspace',
      initializationOptions: {
        schemaPath: '.templjs/default-frontmatter.json',
        contentSchemaPath: '.templjs/default-content.json',
        documentContext: {
          uri: 'file:///workspace/backlog/item.md.templ',
          content: [
            '---',
            '$templ-schema: .templjs/inline-frontmatter.json',
            '$content-schema: .templjs/inline-content.json',
            '---',
            '{"$schema":".templjs/root-frontmatter.json","$content-schema":".templjs/root-content.json"}',
          ].join('\n'),
        },
      },
    };

    expect(resolveDocumentSchemaSources(params)).toEqual({
      schemaPath: '.templjs/inline-frontmatter.json',
      contentSchemaPath: '.templjs/inline-content.json',
    });
    expect(extractDocumentSchemaKey(params.initializationOptions.documentContext.content)).toBe(
      '.templjs/inline-frontmatter.json\0.templjs/inline-content.json'.replace(
        '.templjs/inline-content.json',
        '.templjs/inline-content.json'
      )
    );
  });

  it('falls back to settings when the document uri cannot be converted to a workspace-relative path', () => {
    expect(
      resolveDocumentSchemaSources({
        rootUri: 'file:///workspace',
        initializationOptions: {
          schemaPath: '.templjs/default-frontmatter.json',
          contentSchemaPath: '.templjs/default-content.json',
          documentContext: {
            uri: 'file:///%E0%A4%A',
            content: '',
          },
        },
      })
    ).toEqual({
      schemaPath: '.templjs/default-frontmatter.json',
      contentSchemaPath: '.templjs/default-content.json',
    });
  });

  it('returns empty schema keys for blank or non-object root content', () => {
    expect(extractDocumentSchemaKey('')).toBe('\0');
    expect(extractDocumentSchemaKey('[]')).toBe('\0');
    expect(extractDocumentSchemaKey('{invalid')).toBe('\0');
    expect(extractDocumentSchemaKey('{"$schema":"   ","$content-schema":42}')).toBe('\0');
    expect(
      extractDocumentSchemaKey(
        '{{# schema: .templjs/frontmatter.json }}\n{{# content-schema: .templjs/content.json }}'
      )
    ).toBe('.templjs/frontmatter.json\0.templjs/content.json');
    expect(
      resolveDocumentSchemaSources({
        rootUri: 'file:///workspace',
        initializationOptions: {
          documentContext: {
            uri: 'file:///workspace/data.json.templ',
            content: '{"$schema":".templjs/root.json","$content_schema":".templjs/content.json"}',
          },
        },
      })
    ).toEqual({
      schemaPath: '.templjs/root.json',
      contentSchemaPath: '.templjs/content.json',
    });
  });

  it('returns empty sync schema results when URL loading fails or file paths cannot resolve', () => {
    const log = vi.fn();

    expect(
      loadSchemaSourceSync('https://example.com/schema.json', undefined, undefined, {
        loadUrlSync: () => {
          throw 'sync boom';
        },
        log,
      })
    ).toEqual({});

    expect(
      loadSchemaSourceSync(
        './schemas/frontmatter.json',
        undefined,
        'file:///workspace/doc.md.templ'
      )
    ).toEqual({});

    expect(log).toHaveBeenCalledWith(
      "[templjs] Error loading schema from URL 'https://example.com/schema.json' in sync mode: sync boom"
    );
  });

  it('resolves sync URL fragments and handles processing errors plus missing workspace roots', () => {
    expect(
      loadSchemaSourceSync(
        'https://example.com/schema.json#/definitions/item',
        undefined,
        undefined,
        {
          loadUrlSync: () => ({ definitions: { item: { type: 'string' } } }),
        }
      )
    ).toEqual({
      schema: { type: 'string' },
      schemaUri: 'https://example.com/schema.json',
    });

    const log = vi.fn();
    expect(
      loadSchemaSourceSync(
        'https://example.com/schema.json#/definitions/item',
        undefined,
        undefined,
        {
          loadUrlSync: () => ({
            get definitions() {
              throw 'processing boom';
            },
          }),
          log,
        }
      )
    ).toEqual({});

    expect(
      resolveDocumentSchemaSources({
        initializationOptions: {
          schemaPath: '.templjs/default-frontmatter.json',
          contentSchemaPath: '.templjs/default-content.json',
          documentContext: {
            uri: 'file:///workspace/backlog/item.md.templ',
            content: '',
          },
        },
      })
    ).toEqual({
      schemaPath: '.templjs/default-frontmatter.json',
      contentSchemaPath: '.templjs/default-content.json',
    });

    expect(log).toHaveBeenCalledWith(
      "[templjs] Error processing schema from URL 'https://example.com/schema.json' in sync mode: processing boom"
    );
  });

  it('returns empty sync URL results when no loader is available or a fragment is missing', () => {
    const log = vi.fn();

    expect(
      loadSchemaSourceSync('https://example.com/schema.json', undefined, undefined, { log })
    ).toEqual({});

    expect(
      loadSchemaSourceSync(
        'https://example.com/schema.json#/definitions/missing',
        undefined,
        undefined,
        {
          loadUrlSync: () => ({ definitions: { present: { type: 'string' } } }),
          log,
        }
      )
    ).toEqual({});

    expect(log).toHaveBeenCalledWith(
      "[templjs] Could not load schema URL 'https://example.com/schema.json' in sync mode (not cached and no sync URL loader)"
    );
    expect(log).toHaveBeenCalledWith(
      "[templjs] Schema fragment not found in URL 'https://example.com/schema.json#/definitions/missing'"
    );
  });

  it('returns empty results for async file loading failures and sync empty source references', async () => {
    const log = vi.fn();

    await expect(
      loadSchemaSource('./schemas/missing.json', '/workspace', 'file:///workspace/doc.md.templ', {
        log,
      })
    ).resolves.toEqual({});

    expect(loadSchemaSourceSync('#/definitions/item', undefined, undefined)).toEqual({});
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "[templjs] Error loading schema from path '/workspace/schemas/missing.json':"
      )
    );
  });

  it('falls back when referenced schema files or fragments cannot be dereferenced', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'templjs-schema-'));
    const missingFilePath = path.join(tempDir, 'missing-ref.json');
    const missingFragmentPath = path.join(tempDir, 'missing-fragment.json');
    const scalarRefPath = path.join(tempDir, 'scalar-ref.json');
    const targetPath = path.join(tempDir, 'target.json');

    fs.writeFileSync(
      missingFilePath,
      JSON.stringify({
        $ref: './does-not-exist.json#/definitions/item',
        type: 'string',
      })
    );
    fs.writeFileSync(
      missingFragmentPath,
      JSON.stringify({
        $ref: './target.json#/definitions/missing',
        minLength: 2,
      })
    );
    fs.writeFileSync(
      scalarRefPath,
      JSON.stringify({
        $ref: './target.json#/definitions/flag',
        type: 'string',
      })
    );
    fs.writeFileSync(
      targetPath,
      JSON.stringify({
        definitions: {
          present: { type: 'number' },
          flag: true,
        },
      })
    );

    try {
      expect(loadSchemaSourceSync(missingFilePath, tempDir).schema).toEqual({ type: 'string' });
      expect(loadSchemaSourceSync(missingFragmentPath, tempDir).schema).toEqual({ minLength: 2 });
      expect(loadSchemaSourceSync(scalarRefPath, tempDir).schema).toEqual({ type: 'string' });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns empty results for async empty source references', async () => {
    await expect(loadSchemaSource('#/definitions/item', undefined, undefined)).resolves.toEqual({});
  });
});
