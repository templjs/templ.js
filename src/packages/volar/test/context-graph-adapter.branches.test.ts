import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  contextGraphAdapterTesting,
  createContextGraphSemanticReadAdapter,
} from '../src/context-graph-adapter.js';

const createdTempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'templjs-volar-branches-'));
  createdTempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of createdTempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('ContextGraphSemanticReadAdapter branch coverage', () => {
  it('skips bindings without source paths or unsupported kinds when expanding scoped paths', () => {
    const adapter = createContextGraphSemanticReadAdapter() as unknown as {
      expandScopedPath(path: string, bindings: Array<Record<string, unknown>>): string;
    };

    const resolved = adapter.expandScopedPath('item.name', [
      { name: 'item', kind: 'for-alias' },
      { name: 'item', kind: 'unsupported-kind', sourcePath: 'users' },
    ]);

    expect(resolved).toBe('item.name');
  });

  it('returns null path details when no schema URI is available and metadata query misses', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const details = adapter.getPathDetails(
      {
        operation: 'hover',
        contextBlock: 'content',
      },
      'missing.path',
      {}
    );

    expect(details).toBeNull();
  });

  it('returns null for document definitions with non-registry frontmatter keys', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', 'name: value', '---'].join('\n');
    const offset = text.indexOf('value') + 1;

    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'frontmatter' },
      text,
      offset,
      {}
    );

    expect(target).toBeNull();
  });

  it('returns null for registry-like keys when values are not path-like', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', 'schemaPath: not_a_path', '---'].join('\n');
    const offset = text.indexOf('not_a_path') + 2;

    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'frontmatter' },
      text,
      offset,
      {
        schema: {
          type: 'object',
          properties: {
            schemaPath: {
              type: 'string',
              description: 'Path to schema file',
            },
          },
        },
      }
    );

    expect(target).toBeNull();
  });

  it('returns http path value definitions directly for registry keys', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', 'schemaPath: https://example.com/frontmatter.json', '---'].join('\n');
    const offset = text.indexOf('example.com') + 2;

    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'frontmatter' },
      text,
      offset,
      {
        schema: {
          type: 'object',
          properties: {
            schemaPath: {
              type: 'string',
              format: 'uri',
            },
          },
        },
      }
    );

    expect(target?.uri).toBe('https://example.com/frontmatter.json');
  });

  it('returns null when schema token points to a missing local file', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const documentPath = path.join(tempDir, 'entry.md.tpl');
    writeFileSync(documentPath, '---\n$schema: ./missing.json\n---\nbody');

    const text = ['---', '$schema: ./missing.json', '---', 'body'].join('\n');
    const offset = text.indexOf('missing.json') + 2;

    const target = adapter.resolveDocumentDefinition(
      {
        operation: 'definition',
        contextBlock: 'frontmatter',
        documentUri: pathToFileURL(documentPath).toString(),
      },
      text,
      offset,
      {
        documentUri: pathToFileURL(documentPath).toString(),
        workspaceRoot: tempDir,
      }
    );

    expect(target).toBeNull();
  });

  it('returns null for schema-path definitions outside frontmatter', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'content' },
      'plain text',
      2,
      {}
    );

    expect(target).toBeNull();
  });

  it('returns passthrough definition targets when descriptor path is absent', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: 'file:///schema.json',
      }
    );

    expect(target.uri).toBe('file:///schema.json');
    expect(target.range.start.line).toBe(0);
  });

  it('returns passthrough definition targets for non-file URIs', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: 'https://example.com/schema.json',
        path: 'user.name',
      }
    );

    expect(target.uri).toBe('https://example.com/schema.json');
  });

  it('falls back to root schema location when referenced path cannot be fully resolved', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const rootSchemaPath = path.join(tempDir, 'root.json');
    writeFileSync(
      rootSchemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            scope: {
              $ref: './missing.json#/$defs/scope',
            },
          },
        },
        null,
        2
      )
    );

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(rootSchemaPath).toString(),
        path: 'scope.name',
      }
    );

    expect(target.uri).toBe(pathToFileURL(rootSchemaPath).toString());
    expect(target.range.start.line).toBeGreaterThanOrEqual(0);
  });

  it('falls back to descriptor URI when schema file cannot be opened', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: 'file:///does/not/exist/schema.json',
        path: 'user.name',
      }
    );

    expect(target.uri).toBe('file:///does/not/exist/schema.json');
    expect(target.range.start.line).toBe(0);
  });

  it('returns null from resolvePathDefinition when schema URI is not configured', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const target = adapter.resolvePathDefinition(
      { operation: 'definition', contextBlock: 'content' },
      'user.name',
      {}
    );

    expect(target).toBeNull();
  });

  it('resolves path definitions when schema URI is configured', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');

    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        null,
        2
      )
    );

    const target = adapter.resolvePathDefinition(
      { operation: 'definition', contextBlock: 'content' },
      'user.name',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(target?.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target?.range.start.line).toBeGreaterThanOrEqual(0);
  });

  it('merges allOf content schema refs into content completions', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const defsPath = path.join(tempDir, 'defs.json');
    const contentSchemaPath = path.join(tempDir, 'content-schema.json');

    writeFileSync(
      defsPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            heading: { type: 'string', description: 'Heading text' },
          },
        },
        null,
        2
      )
    );
    writeFileSync(
      contentSchemaPath,
      JSON.stringify(
        {
          type: 'object',
          allOf: [{ $ref: './defs.json' }],
        },
        null,
        2
      )
    );

    const items = adapter.getChildCompletions(
      {
        operation: 'completion',
        contextBlock: 'content',
      },
      '',
      {
        contentSchema: {
          type: 'object',
          allOf: [{ $ref: './defs.json' }],
        },
        contentSchemaUri: pathToFileURL(contentSchemaPath).toString(),
      }
    );

    expect(items).toContainEqual({
      label: 'heading',
      kind: 'variable',
      detail: 'string',
      documentation: 'Heading text',
    });
  });

  it('returns nested child completions when parent-path context includes location metadata', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const items = adapter.getChildCompletions(
      {
        operation: 'completion',
        contextBlock: 'content',
        documentUri: 'file:///workspace/doc.md.tpl',
        offset: 24,
        line: 3,
        character: 5,
      },
      'user',
      {
        schema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'User name' },
              },
            },
          },
        },
      }
    );

    expect(items).toEqual([
      {
        label: 'name',
        kind: 'property',
        detail: 'string',
        documentation: 'User name',
      },
    ]);
  });

  it('returns original schema when private allOf resolution has nothing to merge', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const internals = adapter as unknown as {
      resolveAllOfRefs: (schema: object, schemaUri: string) => object;
    };
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    };

    expect(internals.resolveAllOfRefs(schema, 'file:///workspace/schema.json')).toBe(schema);
  });

  it('returns original schema when allOf refs cannot be resolved', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const internals = adapter as unknown as {
      resolveAllOfRefs: (schema: object, schemaUri: string) => object;
    };
    const schema = {
      type: 'object',
      allOf: [{ $ref: './missing-defs.json' }],
    };

    expect(internals.resolveAllOfRefs(schema, 'file:///workspace/schema.json')).toBe(schema);
  });

  it('skips invalid allOf entries before merging a valid file ref', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const internals = adapter as unknown as {
      resolveAllOfRefs: (schema: object, schemaUri: string) => object;
    };
    const tempDir = makeTempDir();
    const defsPath = path.join(tempDir, 'defs.json');
    const schemaPath = path.join(tempDir, 'schema.json');

    writeFileSync(
      defsPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            slug: { type: 'string' },
          },
        },
        null,
        2
      )
    );
    writeFileSync(schemaPath, '{}');

    const resolved = internals.resolveAllOfRefs(
      {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
        allOf: [null, {}, { $ref: 123 }, { $ref: './defs.json' }],
      },
      pathToFileURL(schemaPath).toString()
    ) as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(resolved.properties)).toEqual(['title', 'slug']);
  });

  it('returns parsed file refs and undefined for invalid private schema-ref targets', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const internals = adapter as unknown as {
      loadSchemaRef: (baseUri: string, ref: string) => unknown;
    };
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');

    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        null,
        2
      )
    );

    expect(internals.loadSchemaRef(pathToFileURL(schemaPath).toString(), '')).toEqual({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    });
    expect(
      internals.loadSchemaRef(pathToFileURL(schemaPath).toString(), '#/properties/user')
    ).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    });
    expect(
      internals.loadSchemaRef(pathToFileURL(schemaPath).toString(), '#/properties/user/missing')
    ).toBeUndefined();
    expect(
      internals.loadSchemaRef('https://example.com/schema.json', './other.json')
    ).toBeUndefined();
  });

  it('decodes JSON pointer segments when resolving private schema refs', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const internals = adapter as unknown as {
      loadSchemaRef: (baseUri: string, ref: string) => unknown;
    };
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');

    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            'foo/bar': {
              type: 'string',
            },
          },
        },
        null,
        2
      )
    );

    expect(
      internals.loadSchemaRef(pathToFileURL(schemaPath).toString(), '#/properties/foo~1bar')
    ).toEqual({ type: 'string' });
  });

  it('returns null path details when fallback schema URI is remote', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const details = adapter.getPathDetails(
      { operation: 'hover', contextBlock: 'content' },
      'user.name',
      {
        schemaUri: 'https://example.com/schema.json',
      }
    );

    expect(details).toBeNull();
  });

  it('returns null path details when fallback schema file contains invalid JSON', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'broken.json');
    writeFileSync(schemaPath, '{ invalid json');

    const details = adapter.getPathDetails(
      {
        operation: 'hover',
        contextBlock: 'content',
      },
      'user.name',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(details).toBeNull();
  });

  it('returns null path details when fallback metadata parsing fails after path resolution', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'almost-valid.json');
    writeFileSync(
      schemaPath,
      [
        '{',
        '  "type": "object",',
        '  "properties": {',
        '    "user": {',
        '      "type": "object",',
        '      "properties": {',
        '        "name": { "type": "string", }',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n')
    );

    const details = adapter.getPathDetails(
      {
        operation: 'hover',
        contextBlock: 'content',
      },
      'user.name',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(details).toBeNull();
  });

  it('returns path details from fallback schema URI metadata lookup', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'details.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'User display name',
                },
              },
            },
          },
        },
        null,
        2
      )
    );

    const details = adapter.getPathDetails(
      {
        operation: 'hover',
        contextBlock: 'content',
      },
      'user.name',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(details?.path).toBe('user.name');
    expect(details?.type).toBe('string');
    expect(details?.description).toBe('User display name');
  });

  it('returns null path details when fallback ref pointer cannot be resolved', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'bad-pointer.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            user: {
              $ref: '#/does/not/exist',
            },
          },
        },
        null,
        2
      )
    );

    const details = adapter.getPathDetails(
      {
        operation: 'hover',
        contextBlock: 'content',
      },
      'user.name',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(details).toBeNull();
  });

  it('returns direct schema URI for pointer-only refs in definition resolution', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            scope: {
              $ref: '#/$defs/scope',
            },
          },
          $defs: {
            scope: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        null,
        2
      )
    );

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: 'scope.name',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBeGreaterThan(0);
  });

  it('returns empty scope bindings for templates without for-loops', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const bindings = adapter.getScopeBindings('plain text only');

    expect(bindings).toEqual([]);
  });

  it('queries snapshots without context metadata', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const response = adapter.query(
      {
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
      },
      {
        version: 'v1',
        nodes: {
          kind: 'templjs.schema-path',
        },
      }
    );

    expect(response.nodes.length).toBeGreaterThan(0);
  });

  it('returns empty completions when context profile does not match built snapshot', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const items = adapter.getChildCompletions(
      {
        operation: 'completion',
        contextBlock: 'content',
        semanticZone: {
          kind: 'body',
          profileId: 'metadata.frontmatter',
        },
      },
      '',
      {
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
      }
    );

    expect(items).toEqual([]);
  });

  it('resolves scoped paths unchanged when no bindings are active', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const resolved = adapter.resolveScopedPath('plain text', 'user.name', 2);

    expect(resolved).toBe('user.name');
  });

  it('keeps scoped paths unchanged inside loops when alias does not match the queried path', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = '{% for item in users %}{{ user.name }}{% endfor %}';
    const offset = text.indexOf('user.name') + 2;
    const resolved = adapter.resolveScopedPath(text, 'user.name', offset);

    expect(resolved).toBe('user.name');
  });

  it('handles deeply nested array item traversal in schema definition fallback', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'nested-items.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            list: {
              type: 'array',
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        null,
        2
      )
    );

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: 'list[0][0].code',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBeGreaterThan(0);
  });

  it('resolves document definitions for schema-like frontmatter keys from schema metadata', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', 'schema_file: ./schema.json', '---'].join('\n');
    const offset = text.indexOf('schema.json') + 2;
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');
    const docPath = path.join(tempDir, 'entry.md.tmpl');
    writeFileSync(schemaPath, JSON.stringify({ type: 'object' }));
    writeFileSync(docPath, text);

    const target = adapter.resolveDocumentDefinition(
      {
        operation: 'definition',
        contextBlock: 'frontmatter',
        documentUri: pathToFileURL(docPath).toString(),
      },
      text,
      offset,
      {
        documentUri: pathToFileURL(docPath).toString(),
        workspaceRoot: tempDir,
        schema: {
          type: 'object',
          properties: {
            schema_file: {
              type: 'string',
              description: 'schema file path',
            },
          },
        },
      }
    );

    expect(target?.uri).toBe(pathToFileURL(schemaPath).toString());
  });

  it('resolves content schema keys to URLs in frontmatter definitions', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', '$content-schema: https://example.com/content.json', '---'].join('\n');
    const offset = text.indexOf('content.json') + 2;

    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'frontmatter' },
      text,
      offset,
      {}
    );

    expect(target?.uri).toBe('https://example.com/content.json');
  });

  it('returns null for non-frontmatter schema token lookups', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'content' },
      '$schema: ./schema.json',
      5,
      {}
    );

    expect(target).toBeNull();
  });

  it('returns null path details when fallback metadata has no entry for resolved target path', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'boolean-prop.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            flag: true,
          },
        },
        null,
        2
      )
    );

    const details = adapter.getPathDetails(
      {
        operation: 'hover',
        contextBlock: 'content',
      },
      'flag',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(details).toBeNull();
  });

  it('builds snapshots when schema properties include boolean sub-schemas', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const response = adapter.query(
      {
        schema: {
          type: 'object',
          properties: {
            enabled: true,
            mode: {
              type: 'string',
              enum: ['on', { invalid: 'enum-object' }],
            },
          },
        },
      },
      {
        version: 'v1',
        nodes: {
          kind: 'templjs.schema-enum-value',
        },
      },
      {
        operation: 'completion',
        contextBlock: 'frontmatter',
      }
    );

    expect(
      response.nodes.some(
        (node: { attributes?: Record<string, unknown> }) => node.attributes?.label === 'on'
      )
    ).toBe(true);
  });

  it('falls back to descriptor URI when path resolution across refs cannot resolve nested segments', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const rootSchemaPath = path.join(tempDir, 'root.json');
    const refSchemaPath = path.join(tempDir, 'ref.json');

    writeFileSync(
      rootSchemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            scope: {
              $ref: './ref.json#/$defs/scope',
            },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      refSchemaPath,
      JSON.stringify(
        {
          $defs: {
            scope: {
              type: 'object',
              properties: {
                leaf: { type: 'string' },
              },
            },
          },
        },
        null,
        2
      )
    );

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(rootSchemaPath).toString(),
        path: 'scope.missing',
      }
    );

    expect(target.uri).toBe(pathToFileURL(rootSchemaPath).toString());
    expect(target.range.start.line).toBe(0);
    expect(target.range.start.character).toBe(0);
  });

  it('resolves value-token definitions across nested combinators', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'combinators.json');

    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          allOf: [
            {
              properties: {
                profile: {
                  type: 'object',
                  anyOf: [
                    {
                      properties: {
                        status: {
                          type: 'string',
                          enum: ['draft', 'published'],
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        null,
        2
      )
    );

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: 'profile.status',
        pathKind: 'value',
        valueToken: 'draft',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBeGreaterThan(0);
  });

  it('resolves definition location to root when descriptor path is empty after normalization', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'root-only.json');
    writeFileSync(schemaPath, JSON.stringify({ type: 'object' }, null, 2));

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: '[0]',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBe(0);
  });

  it('returns null path details when schema URI cannot be resolved from remote refs', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'remote-ref.json');

    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            profile: {
              $ref: 'https://example.com/schema.json#/$defs/profile',
            },
          },
        },
        null,
        2
      )
    );

    const details = adapter.getPathDetails(
      { operation: 'hover', contextBlock: 'content' },
      'profile.name',
      {
        schemaUri: pathToFileURL(schemaPath).toString(),
      }
    );

    expect(details).toBeNull();
  });

  it('returns null when schema metadata path-like key value does not parse as a path', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', 'schemaFile: maybe', '---'].join('\n');
    const offset = text.indexOf('maybe') + 1;

    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'frontmatter' },
      text,
      offset,
      {
        schema: {
          type: 'object',
          properties: {
            schemaFile: {
              type: 'string',
              description: 'schema file',
            },
          },
        },
      }
    );

    expect(target).toBeNull();
  });

  it('resolves local file URLs from frontmatter path-style values', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');
    const docPath = path.join(tempDir, 'entry.md.tmpl');
    writeFileSync(schemaPath, JSON.stringify({ type: 'object' }));

    const text = ['---', 'schemaPath: ./schema.json', '---'].join('\n');
    writeFileSync(docPath, text);
    const offset = text.indexOf('schema.json') + 1;

    const target = adapter.resolveDocumentDefinition(
      {
        operation: 'definition',
        contextBlock: 'frontmatter',
        documentUri: pathToFileURL(docPath).toString(),
      },
      text,
      offset,
      {
        documentUri: pathToFileURL(docPath).toString(),
        workspaceRoot: tempDir,
        schema: {
          type: 'object',
          properties: {
            schemaPath: {
              type: 'string',
              format: 'uri-reference',
            },
          },
        },
      }
    );

    expect(target?.uri).toBe(pathToFileURL(schemaPath).toString());
  });

  it('returns null for frontmatter schema references with unsupported token formats', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = ['---', '$schema: schema_without_extension', '---'].join('\n');
    const offset = text.indexOf('schema_without_extension') + 2;

    const target = adapter.resolveDocumentDefinition(
      { operation: 'definition', contextBlock: 'frontmatter' },
      text,
      offset,
      {}
    );

    expect(target).toBeNull();
  });

  it('falls back to zero-range target when ref target file read fails', () => {
    const tempDir = makeTempDir();
    const rootSchemaPath = path.join(tempDir, 'root.json');
    const refSchemaPath = path.join(tempDir, 'ref.json');

    writeFileSync(
      rootSchemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            scope: {
              $ref: './ref.json#/$defs/scope',
            },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      refSchemaPath,
      JSON.stringify(
        {
          $defs: {
            scope: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        null,
        2
      )
    );

    let refReadCount = 0;
    const adapter = createContextGraphSemanticReadAdapter({
      readTextFile: (filePath) => {
        if (/[\\/]ref\.json$/.test(filePath)) {
          // The first read comes from resolvePathDefinitionAcrossRefs ($ref traversal).
          // The second read comes from resolveDefinitionLocation after the ref is resolved.
          // We let the traversal succeed and simulate failure only on the subsequent read.
          refReadCount++;
          if (refReadCount > 1) {
            throw new Error('synthetic read failure');
          }
        }
        return readFileSync(filePath, 'utf-8');
      },
    });

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(rootSchemaPath).toString(),
        path: 'scope.name',
      }
    );

    expect(target.uri).toBe(pathToFileURL(refSchemaPath).toString());
    expect(target.range.start.line).toBe(0);
    expect(target.range.start.character).toBe(0);
  });
});

describe('context-graph helper branch coverage', () => {
  it('detects schema path registry keys from format, key names, and descriptions', () => {
    const keys = contextGraphAdapterTesting.getPathRegistryKeysFromSchema({
      type: 'object',
      properties: {
        schemaUri: { type: 'string', format: 'uri' },
        configFile: { type: 'string' },
        note: { type: 'string', description: 'path to data file' },
        ignored: true,
      },
    });

    expect(keys.has('schemaUri')).toBe(true);
    expect(keys.has('configFile')).toBe(true);
    expect(keys.has('note')).toBe(true);
    expect(keys.has('ignored')).toBe(false);
    expect(contextGraphAdapterTesting.getPathRegistryKeysFromSchema({ type: 'object' }).size).toBe(
      0
    );
  });

  it('classifies likely path tokens across URL and suffix forms', () => {
    expect(contextGraphAdapterTesting.isLikelyPathValue('')).toBe(false);
    expect(contextGraphAdapterTesting.isLikelyPathValue('https://example.com/a.json')).toBe(true);
    expect(contextGraphAdapterTesting.isLikelyPathValue('./schema.json#/$defs/x')).toBe(true);
    expect(contextGraphAdapterTesting.isLikelyPathValue('not_a_path')).toBe(false);
  });

  it('returns zero-range definition targets', () => {
    const target = contextGraphAdapterTesting.toDefinitionTarget('file:///schema.json');
    expect(target.uri).toBe('file:///schema.json');
    expect(target.range.start.line).toBe(0);
  });

  it('returns null schema-path definitions for non-frontmatter text', () => {
    const target = contextGraphAdapterTesting.getSchemaPathDefinition('plain', 2, {});
    expect(target).toBeNull();
  });

  it('returns null path-value definitions when key is outside registry', () => {
    const text = ['---', 'title: hello', '---'].join('\n');
    const offset = text.indexOf('hello') + 1;
    const target = contextGraphAdapterTesting.getPathValueDefinition(text, offset, {
      schema: { type: 'object', properties: { title: { type: 'string' } } },
    });
    expect(target).toBeNull();
  });

  it('returns null path-value definitions when schema source cannot be resolved', () => {
    const text = ['---', '$schema: ./missing/schema.json', '---'].join('\n');
    const offset = text.indexOf('schema.json') + 1;

    const target = contextGraphAdapterTesting.getPathValueDefinition(text, offset, {
      workspaceRoot: '/definitely/missing/workspace',
      documentUri: 'file:///definitely/missing/workspace/doc.md.tmpl',
    });

    expect(target).toBeNull();
  });

  it('returns null path-value definitions when no workspace or document root can resolve a relative source', () => {
    const text = ['---', '$schema: ./missing.json', '---'].join('\n');
    const offset = text.indexOf('missing.json') + 1;

    const target = contextGraphAdapterTesting.getPathValueDefinition(text, offset, {});

    expect(target).toBeNull();
  });

  it('resolves content schema keys from frontmatter key tokens', () => {
    const target = contextGraphAdapterTesting.getSchemaPathDefinition(
      ['---', '$content-schema: "https://example.com/content.json"', '---'].join('\n'),
      16,
      {}
    );

    expect(target?.uri).toBe('https://example.com/content.json');
  });

  it('returns null schema-path definitions when a relative json token cannot be resolved', () => {
    const text = ['---', '$schema: ./missing.json', '---'].join('\n');
    const offset = text.indexOf('missing.json') + 1;

    const target = contextGraphAdapterTesting.getSchemaPathDefinition(text, offset, {});
    expect(target).toBeNull();
  });

  it('returns null schema-path definitions when no token can be extracted', () => {
    const text = ['---', '$schema: ', '---'].join('\n');
    const offset = text.indexOf('$schema:') + '$schema:'.length + 1;
    const target = contextGraphAdapterTesting.getSchemaPathDefinition(text, offset, {});

    expect(target).toBeNull();
  });

  it('resolves content-schema key definitions to existing local schema files', () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'content.schema.json');
    writeFileSync(schemaPath, '{"type":"object"}', 'utf8');
    const text = ['---', '$content-schema: ./content.schema.json', '---'].join('\n');
    const offset = text.indexOf('$content-schema') + 2;

    const target = contextGraphAdapterTesting.getSchemaPathDefinition(text, offset, {
      workspaceRoot: tempDir,
      documentUri: pathToFileURL(path.join(tempDir, 'doc.md.tmpl')).toString(),
    });

    expect(target?.uri).toBe(pathToFileURL(schemaPath).toString());
  });

  it('returns null schema-path definitions when the resolved local file is missing', () => {
    const tempDir = makeTempDir();
    const text = ['---', '$schema: ./missing.schema.json', '---'].join('\n');
    const offset = text.indexOf('missing.schema.json') + 1;

    const target = contextGraphAdapterTesting.getSchemaPathDefinition(text, offset, {
      workspaceRoot: tempDir,
      documentUri: pathToFileURL(path.join(tempDir, 'doc.md.tmpl')).toString(),
    });

    expect(target).toBeNull();
  });

  it('resolves registered path-value definitions to existing local schema files', () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'data.schema.json');
    writeFileSync(schemaPath, '{"type":"object"}', 'utf8');
    const text = ['---', 'schemaPath: ./data.schema.json', '---'].join('\n');
    const offset = text.indexOf('data.schema.json') + 1;

    const target = contextGraphAdapterTesting.getPathValueDefinition(text, offset, {
      workspaceRoot: tempDir,
      documentUri: pathToFileURL(path.join(tempDir, 'doc.md.tmpl')).toString(),
      schema: {
        type: 'object',
        properties: {
          schemaPath: { type: 'string', format: 'uri-reference' },
        },
      },
    });

    expect(target?.uri).toBe(pathToFileURL(schemaPath).toString());
  });

  it('computes line/character positions from offsets', () => {
    const pos = contextGraphAdapterTesting.getPositionForOffset('a\nbc\n', 3);
    expect(pos.line).toBe(1);
    expect(pos.character).toBe(1);
  });

  it('finds matching brackets while ignoring string-embedded delimiters', () => {
    const text = '{"a":"{x}","b":1}';
    const end = contextGraphAdapterTesting.findMatchingBracket(text, 0, '{', '}');
    expect(end).toBe(text.length - 1);

    const unmatched = '{"a":"unterminated"';
    expect(contextGraphAdapterTesting.findMatchingBracket(unmatched, 0, '{', '}')).toBe(-1);
  });

  it('skips leading whitespace and finds string ends with escapes', () => {
    expect(contextGraphAdapterTesting.skipWhitespace('   x', 0)).toBe(3);
    expect(contextGraphAdapterTesting.findStringEnd('"a\\"b"', 0)).toBe(5);
  });

  it('finds value ranges for objects arrays strings and scalars', () => {
    const json = '{"o":{},"a":[],"s":"x","n":1}';
    const oStart = json.indexOf('{}');
    const aStart = json.indexOf('[]');
    const sStart = json.indexOf('"x"');
    const nStart = json.indexOf('1}');

    expect(contextGraphAdapterTesting.findValueRange(json, oStart, json.length - 1)?.end).toBe(
      oStart + 2
    );
    expect(contextGraphAdapterTesting.findValueRange(json, aStart, json.length - 1)?.end).toBe(
      aStart + 2
    );
    expect(contextGraphAdapterTesting.findValueRange(json, sStart, json.length - 1)?.end).toBe(
      sStart + 3
    );
    expect(contextGraphAdapterTesting.findValueRange(json, nStart, json.length - 1)?.end).toBe(
      nStart + 1
    );
    expect(contextGraphAdapterTesting.findValueRange(json, json.length, json.length)).toBeNull();
  });

  it('finds top-level object properties and handles invalid bounds', () => {
    const text = '{"a":1,"b":{"x":2}}';
    expect(
      contextGraphAdapterTesting.findTopLevelPropertyInObjectRange(text, 'b', 0, text.length)
    ).not.toBeNull();
    expect(
      contextGraphAdapterTesting.findTopLevelPropertyInObjectRange(text, 'missing', 0, text.length)
    ).toBeNull();
    expect(
      contextGraphAdapterTesting.findTopLevelPropertyInObjectRange(text, 'a', 1, text.length)
    ).toBeNull();
    expect(
      contextGraphAdapterTesting.findTopLevelPropertyInObjectRange('{"a":"x', 'a', 0, 7)
    ).toBeNull();
  });

  it('collects top-level object ranges in arrays and exits on malformed entries', () => {
    const text = '[{"a":1},{"b":2}]';
    const ranges = contextGraphAdapterTesting.collectTopLevelObjectRangesInArray(
      text,
      0,
      text.length
    );
    expect(ranges.length).toBe(2);

    const malformed = '[{"a":1';
    expect(
      contextGraphAdapterTesting.collectTopLevelObjectRangesInArray(malformed, 0, malformed.length)
        .length
    ).toBe(0);

    const scalarArray = '[1,2,3]';
    expect(
      contextGraphAdapterTesting.collectTopLevelObjectRangesInArray(
        scalarArray,
        0,
        scalarArray.length
      )
    ).toEqual([]);
  });

  it('finds properties through combinators and nested recursive branches', () => {
    const schemaText = JSON.stringify(
      {
        type: 'object',
        allOf: [
          {
            anyOf: [
              {
                properties: {
                  profile: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                },
              },
            ],
          },
        ],
      },
      null,
      2
    );

    const rootStart = schemaText.indexOf('{');
    const entry = contextGraphAdapterTesting.findPropertyViaCombinators(
      schemaText,
      'profile',
      rootStart,
      schemaText.length
    );
    expect(entry).not.toBeNull();
  });

  it('walks items scopes when nested properties miss and returns null for unmatched segment', () => {
    const schemaText = JSON.stringify(
      {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
            },
          },
        },
      },
      null,
      2
    );

    const result = contextGraphAdapterTesting.findPropertyViaSchemaStructure(
      schemaText,
      'rows.missing'
    );
    expect(result).toBeNull();
  });

  it('returns null for schema-structure inputs without a searchable root path', () => {
    expect(contextGraphAdapterTesting.findPropertyViaSchemaStructure('[]', 'title')).toBeNull();
    expect(
      contextGraphAdapterTesting.findPropertyViaSchemaStructure('{"properties": {', 'title')
    ).toBeNull();
    expect(
      contextGraphAdapterTesting.findPropertyViaSchemaStructure('{"type":"object"}', '')
    ).toBeNull();
  });

  it('covers schema-structure parser helper edge cases', () => {
    expect(contextGraphAdapterTesting.findMatchingBracket('{"title": true', 0, '{', '}')).toBe(-1);
    expect(
      contextGraphAdapterTesting.collectTopLevelObjectRangesInArray('{"allOf":[]}', -1, 0)
    ).toEqual([]);
    expect(contextGraphAdapterTesting.collectTopLevelObjectRangesInArray('[]', 0, 2)).toEqual([]);
  });

  it('resolves direct property matches inside combinator branches', () => {
    const schemaText = JSON.stringify(
      {
        allOf: [
          {
            title: {
              type: 'string',
            },
          },
        ],
      },
      null,
      2
    );

    const result = contextGraphAdapterTesting.findPropertyViaCombinators(
      schemaText,
      'title',
      0,
      schemaText.length
    );
    expect(result).not.toBeNull();
  });

  it('continues items traversal when nested properties are absent', () => {
    const schemaText = JSON.stringify(
      {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
        },
      },
      null,
      2
    );

    const result = contextGraphAdapterTesting.findPropertyViaSchemaStructure(
      schemaText,
      'rows.anything'
    );
    expect(result).toBeNull();
  });

  it('resolves property matches through items traversal and combinator fallback', () => {
    const schemaText = JSON.stringify(
      {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cols: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      null,
      2
    );

    const byStructure = contextGraphAdapterTesting.findPropertyViaSchemaStructure(
      schemaText,
      'rows[0].cols[0].value'
    );
    expect(byStructure).not.toBeNull();
  });

  it('splits property paths and resolves target URI for refs', () => {
    expect(contextGraphAdapterTesting.splitPropertyPath('rows[0].value')).toEqual([
      'rows',
      'value',
    ]);
    expect(
      contextGraphAdapterTesting.resolveRefTargetUri('file:///tmp/root.json', '#/$defs/x')
    ).toBe('file:///tmp/root.json');
    expect(
      contextGraphAdapterTesting.resolveRefTargetUri('https://example.com/root.json', './x.json')
    ).toBeNull();
    expect(
      contextGraphAdapterTesting.resolveRefTargetUri(
        'file:///tmp/root.json',
        'https://example.com/s.json'
      )
    ).toBe('https://example.com/s.json');
    expect(contextGraphAdapterTesting.stripJsonQuotes('plain')).toBe('plain');
    expect(contextGraphAdapterTesting.stripJsonQuotes('"quoted"')).toBe('quoted');
  });

  it('returns null when resolving relative refs from malformed file URIs', () => {
    expect(contextGraphAdapterTesting.resolveRefTargetUri('file://%zz', './x.json')).toBeNull();
  });

  it('finds object ranges by JSON pointer and handles invalid pointers', () => {
    const schemaText = JSON.stringify(
      {
        $defs: {
          profile: {
            type: 'object',
          },
        },
      },
      null,
      2
    );

    const range = contextGraphAdapterTesting.findObjectRangeByPointer(
      schemaText,
      '#/$defs/profile'
    );
    expect(range).not.toBeNull();
    expect(contextGraphAdapterTesting.findObjectRangeByPointer('[]', '#/$defs/profile')).toBeNull();
    expect(contextGraphAdapterTesting.findObjectRangeByPointer(schemaText, '#/missing')).toBeNull();
    expect(
      contextGraphAdapterTesting.findObjectRangeByPointer(schemaText, 'defs/profile')
    ).not.toBeNull();
  });

  it('serializes circular and nested structures without throwing', () => {
    const value: Record<string, unknown> = {
      list: [1, 2, { name: 'x' }],
    };
    value.self = value;

    const serialized = contextGraphAdapterTesting.stableSerialize(value);
    expect(serialized).toContain('[Circular]');
    expect(serialized).toContain('"list"');
  });

  it('returns value-token offsets when requested token exists inside property range', () => {
    const schemaText = JSON.stringify(
      {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'published'],
          },
        },
      },
      null,
      2
    );

    const offset = contextGraphAdapterTesting.findBestPropertyOffset(
      schemaText,
      'status',
      'value',
      'draft'
    );
    expect(offset).toBeGreaterThan(schemaText.indexOf('"status"'));

    const fallbackOffset = contextGraphAdapterTesting.findBestPropertyOffset(
      schemaText,
      'status',
      'value',
      'missing-token'
    );
    expect(fallbackOffset).toBe(schemaText.indexOf('"status"'));
  });

  it('strips JSON quotes when both ends are quoted and leaves plain values untouched', () => {
    const quoted = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs;
    expect(typeof quoted).toBe('function');
    expect(
      contextGraphAdapterTesting.getSchemaPathDefinition(
        ['---', '$schema: "https://example.com/a.json"', '---'].join('\n'),
        16,
        {}
      )?.uri
    ).toBe('https://example.com/a.json');
  });

  it('returns null when resolving refs from non-file roots', () => {
    const resolved = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs(
      'https://example.com/schema.json',
      'user.name',
      'property',
      undefined
    );

    expect(resolved).toBeNull();
  });

  it('returns partial path targets when a non-object segment appears before path exhaustion', () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'non-object-midpath.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            flag: true,
          },
        },
        null,
        2
      )
    );

    const resolved = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs(
      pathToFileURL(schemaPath).toString(),
      'flag.name',
      'property',
      undefined
    );

    expect(resolved?.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(resolved?.pathAtTarget).toBe('flag');
  });

  it('returns root target descriptor when resolving empty normalized paths', () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'empty-path.json');
    writeFileSync(schemaPath, JSON.stringify({ type: 'object' }, null, 2));

    const resolved = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs(
      pathToFileURL(schemaPath).toString(),
      '',
      'property',
      undefined
    );

    expect(resolved?.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(resolved?.startOffset).toBe(0);
    expect(resolved?.pathAtTarget).toBe('');
  });

  it('resolves profile/zone defaults when semantic context metadata is absent', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const response = adapter.query(
      {
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
      },
      {
        version: 'v1',
        nodes: { kind: 'templjs.schema-path' },
      },
      {
        operation: 'completion',
      }
    );

    expect(response.nodes.length).toBeGreaterThan(0);
    expect(response.nodes[0]?.attributes?.zoneKind).toBe('content');
  });

  it('maps non-string path details attributes to undefined', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    (adapter as unknown as { query: unknown }).query = () => ({
      version: 'v1',
      revision: 1,
      nodes: [
        {
          id: 'x',
          profileId: 'content.body',
          kind: 'templjs.schema-path',
          attributes: {
            type: 123,
            description: false,
          },
        },
      ],
      edges: [],
    });

    const details = adapter.getPathDetails(
      { operation: 'hover', contextBlock: 'content' },
      'title',
      {}
    );

    expect(details?.type).toBeUndefined();
    expect(details?.description).toBeUndefined();
  });

  it('maps completion item attributes when description/type are missing or empty', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    (adapter as unknown as { query: unknown }).query = () => ({
      version: 'v1',
      revision: 1,
      nodes: [
        {
          id: 'x',
          profileId: 'content.body',
          kind: 'templjs.schema-path',
          attributes: {
            label: 'title',
            type: 999,
            description: '',
          },
        },
      ],
      edges: [],
    });

    const items = adapter.getChildCompletions(
      { operation: 'completion', contextBlock: 'content' },
      '',
      {}
    );

    expect(items[0]?.detail).toBeUndefined();
    expect(items[0]?.documentation).toBeUndefined();
  });

  it('maps enum completions with empty labels when attributes are absent', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    (adapter as unknown as { query: unknown }).query = () => ({
      version: 'v1',
      revision: 1,
      nodes: [
        {
          id: 'x',
          profileId: 'content.body',
          kind: 'templjs.schema-enum-value',
          attributes: {},
        },
      ],
      edges: [],
    });

    const items = adapter.getEnumValueCompletions(
      { operation: 'completion', contextBlock: 'content' },
      'status',
      {}
    );

    expect(items[0]?.label).toBe('');
    expect(items[0]?.detail).toBe('status enum');
  });

  it('resolves multi-segment path through a fragment-free cross-file $ref at a non-terminal segment', () => {
    const tempDir = makeTempDir();
    const rootSchema = path.join(tempDir, 'root.json');
    const profileSchema = path.join(tempDir, 'profile.json');

    writeFileSync(
      rootSchema,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            user: { $ref: './profile.json' },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      profileSchema,
      JSON.stringify({ type: 'object', properties: { name: { type: 'string' } } }, null, 2)
    );

    const resolved = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs(
      pathToFileURL(rootSchema).toString(),
      'user.name',
      'property',
      undefined
    );

    // Non-terminal $ref without fragment uses '#' as targetPointer (splitRef.fragment ?? '#' fallback).
    expect(resolved?.uri).toBe(pathToFileURL(profileSchema).toString());
    expect(resolved?.pathAtTarget).toBe('name');
  });

  it('follows $ref on the terminal path segment to the referenced target schema', () => {
    const tempDir = makeTempDir();
    const rootSchema = path.join(tempDir, 'root.json');
    const targetSchema = path.join(tempDir, 'user.json');

    writeFileSync(
      rootSchema,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            user: { $ref: './user.json' },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      targetSchema,
      JSON.stringify({ type: 'object', properties: { name: { type: 'string' } } }, null, 2)
    );

    const resolved = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs(
      pathToFileURL(rootSchema).toString(),
      'user',
      'property',
      undefined
    );

    // Terminal segment is a $ref; should follow it to the referenced schema URI.
    expect(resolved?.uri).toBe(pathToFileURL(targetSchema).toString());
  });

  it('follows chained $ref through the empty-segments fallback path', () => {
    const tempDir = makeTempDir();
    const rootSchema = path.join(tempDir, 'root.json');
    const bridgeSchema = path.join(tempDir, 'bridge.json');
    const finalSchema = path.join(tempDir, 'final.json');

    writeFileSync(
      rootSchema,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            entity: { $ref: './bridge.json' },
          },
        },
        null,
        2
      )
    );

    // bridge.json is itself a bare $ref – this exercises the empty-segments
    // fallback path that follows $ref when remainingSegments is already empty.
    writeFileSync(bridgeSchema, JSON.stringify({ $ref: './final.json' }, null, 2));

    writeFileSync(
      finalSchema,
      JSON.stringify({ type: 'object', properties: { id: { type: 'string' } } }, null, 2)
    );

    const resolved = contextGraphAdapterTesting.resolvePathDefinitionAcrossRefs(
      pathToFileURL(rootSchema).toString(),
      'entity',
      'property',
      undefined
    );

    // root.entity -> bridge.json ($ref) -> final.json
    expect(resolved?.uri).toBe(pathToFileURL(finalSchema).toString());
  });

  it('falls back to zero-range target when ref-resolved schema text cannot be read', () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'root.json');
    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
        },
        null,
        2
      )
    );

    const adapter = createContextGraphSemanticReadAdapter({
      readTextFile: () => {
        throw new Error('synthetic read failure');
      },
    });

    const target = adapter.resolveDefinitionLocation(
      { operation: 'definition', contextBlock: 'content' },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: '',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBe(0);
  });
});
