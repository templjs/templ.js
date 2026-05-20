import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as core from '@templjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContextGraphSemanticReadAdapter } from '../src/context-graph-adapter.js';

const createdTempDirs: string[] = [];

function createTempDir(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'templjs-volar-'));
  createdTempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of createdTempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

const frontmatterSchema = {
  type: 'object',
  properties: {
    frontData: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    },
  },
};

const contentSchema = {
  type: 'object',
  properties: {
    contentData: {
      type: 'object',
      properties: {
        heading: { type: 'string' },
      },
    },
  },
};

describe('ContextGraphSemanticReadAdapter', () => {
  it('memoizes snapshots across repeated queries for identical schemas', () => {
    const adapter = createContextGraphSemanticReadAdapter();

    const options = { schema: frontmatterSchema, contentSchema };
    const request = {
      version: 'v1' as const,
      nodes: {
        kind: 'schema-path' as const,
      },
    };
    const first = adapter.query(options, request);
    const second = adapter.query(options, request);

    expect(first.revision).toBe(second.revision);
    expect(first.nodes).toEqual(second.nodes);
    expect(first.nodes.length).toBeGreaterThan(0);
    expect(first.nodes.some((node) => node.provenance?.providerId === 'templjs-schema')).toBe(true);
    // Public memoization signal: repeated queries return references to the same
    // underlying context node objects from the cached snapshot.
    expect(first.nodes[0]).toBe(second.nodes[0]);
  });

  it('separates completion candidates by schema source', () => {
    const adapter = createContextGraphSemanticReadAdapter();

    const frontmatter = adapter.getChildCompletions(
      {
        operation: 'completion',
        contextBlock: 'frontmatter',
        documentUri: 'file:///workspace/doc.md.tpl',
        line: 0,
        character: 0,
      },
      '',
      {
        schema: frontmatterSchema,
        contentSchema,
      }
    );

    const content = adapter.getChildCompletions(
      {
        operation: 'completion',
        contextBlock: 'content',
        documentUri: 'file:///workspace/doc.md.tpl',
        line: 10,
        character: 2,
      },
      '',
      {
        schema: frontmatterSchema,
        contentSchema,
      }
    );

    expect(frontmatter.map((item) => item.label)).toEqual(['frontData']);
    expect(content.map((item) => item.label)).toEqual(['contentData']);
  });

  it('filters query results by operation from location context', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const options = { schema: frontmatterSchema, contentSchema };

    const completionResponse = adapter.query(
      options,
      {
        version: 'v1',
        nodes: {
          kind: 'schema-path',
          attributeEquals: {
            operation: 'completion',
            contextBlock: 'frontmatter',
          },
        },
      },
      {
        operation: 'completion',
        contextBlock: 'frontmatter',
        documentUri: 'file:///workspace/doc.md.tpl',
        offset: 12,
        line: 1,
        character: 3,
      }
    );

    const hoverResponse = adapter.query(
      options,
      {
        version: 'v1',
        nodes: {
          kind: 'schema-path',
          attributeEquals: {
            operation: 'hover',
            contextBlock: 'frontmatter',
          },
        },
      },
      {
        operation: 'completion',
        contextBlock: 'frontmatter',
        documentUri: 'file:///workspace/doc.md.tpl',
        offset: 12,
        line: 1,
        character: 3,
      }
    );

    expect(completionResponse.nodes.length).toBeGreaterThan(0);
    expect(hoverResponse.nodes).toEqual([]);
  });

  it('resolves nested aliases by climbing active scope stack', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = [
      '{% for item in items %}',
      '  {% for item in item.children %}',
      '    {{ item.name }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');

    const itemIdentifierStart = text.indexOf('item.name');
    // Move the cursor inside the alias identifier (`it` in `item.name`) for scope resolution.
    const offset = itemIdentifierStart + 'it'.length;
    const resolved = adapter.resolveScopedPath(text, 'item.name', offset);

    expect(resolved).toBe('items[0].children[0].name');
  });

  it('resolves schema definition locations with concrete file ranges', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = createTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');

    writeFileSync(
      schemaPath,
      JSON.stringify(
        {
          type: 'object',
          properties: {
            relationships: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['project'],
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
      {
        operation: 'definition',
        contextBlock: 'frontmatter',
      },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: 'relationships[0].type',
        pathKind: 'property',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBeGreaterThan(0);
    expect(target.range.end.line).toBeGreaterThanOrEqual(target.range.start.line);
  });

  it('resolves allOf-wrapped property definitions without broad key fallback', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = createTempDir();
    const schemaPath = path.join(tempDir, 'schema-allof.json');

    const schemaText = JSON.stringify(
      {
        type: 'object',
        allOf: [
          {
            type: 'object',
            properties: {
              type: {
                const: 'project',
              },
            },
          },
        ],
      },
      null,
      2
    );
    writeFileSync(schemaPath, schemaText);

    const schemaLines = schemaText.split('\n');
    const expectedPropertyLine = schemaLines.findIndex((line) => /^\s*"type":\s*\{\s*$/.test(line));
    expect(expectedPropertyLine).toBeGreaterThan(-1);

    const target = adapter.resolveDefinitionLocation(
      {
        operation: 'definition',
        contextBlock: 'frontmatter',
      },
      {
        uri: pathToFileURL(schemaPath).toString(),
        path: 'type',
        pathKind: 'property',
      }
    );

    expect(target.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target.range.start.line).toBe(expectedPropertyLine);
  });

  it('resolves document path references without server-side helpers', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = createTempDir();
    const schemaPath = path.join(tempDir, 'frontmatter.json');
    const documentPath = path.join(tempDir, 'template.md.tpl');

    writeFileSync(schemaPath, '{}');

    const text = ['---', '$schema: ./frontmatter.json', '---', 'body'].join('\n');
    const offset = text.indexOf('frontmatter.json') + 2;

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

    expect(target?.uri).toBe(pathToFileURL(schemaPath).toString());
    expect(target?.range.start.line).toBe(0);
  });

  it('resolves definition locations across external refs for nested scope paths', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = createTempDir();
    const supportDir = path.join(tempDir, 'support');
    const contentDir = path.join(tempDir, 'content');
    const commonSchemaPath = path.join(supportDir, 'common.json');
    const contentSchemaPath = path.join(contentDir, 'project.json');

    mkdirSync(supportDir, { recursive: true });
    mkdirSync(contentDir, { recursive: true });

    writeFileSync(
      commonSchemaPath,
      JSON.stringify(
        {
          $defs: {
            scopeBlock: {
              type: 'object',
              properties: {
                included: { type: 'array', items: { type: 'string' } },
                excluded: { type: 'array', items: { type: 'string' } },
              },
            },
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
          properties: {
            scope: {
              $ref: '../support/common.json#/$defs/scopeBlock',
            },
          },
        },
        null,
        2
      )
    );

    const commonLines = readFileSync(commonSchemaPath, 'utf-8').split('\n');
    const includedLine = commonLines.findIndex((line) => /"included"\s*:\s*\{/.test(line));
    expect(includedLine).toBeGreaterThan(-1);

    const target = adapter.resolveDefinitionLocation(
      {
        operation: 'definition',
        contextBlock: 'content',
      },
      {
        uri: pathToFileURL(contentSchemaPath).toString(),
        path: 'scope.included',
        pathKind: 'property',
      }
    );

    expect(target.uri).toBe(pathToFileURL(commonSchemaPath).toString());
    expect(target.range.start.line).toBe(includedLine);
  });
});

describe('ContextGraphSemanticReadAdapter.resolveLocalAliasDefinition', () => {
  it('returns declaration range for a for-loop alias using default delimiters', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 2;

    const result = adapter.resolveLocalAliasDefinition(text, 'item', offset);

    expect(result).not.toBeNull();
    expect(result!.start).toBeGreaterThanOrEqual(0);
    expect(result!.end).toBeGreaterThan(result!.start);
  });

  it('returns null when cursor is outside any for-loop scope', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = '{% for item in users %}{{ item.name }}{% endfor %} outside';
    const offset = text.indexOf('outside') + 2;

    const result = adapter.resolveLocalAliasDefinition(text, 'item', offset);

    expect(result).toBeNull();
  });

  it('returns null when alias does not match any scope alias', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = '{% for item in users %}{{ other.name }}{% endfor %}';
    const offset = text.indexOf('other.name') + 2;

    const result = adapter.resolveLocalAliasDefinition(text, 'other', offset);

    expect(result).toBeNull();
  });

  it('matches alias path prefixes like item.name for alias item', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 2;

    const result = adapter.resolveLocalAliasDefinition(text, 'item.name', offset);

    expect(result).not.toBeNull();
  });

  it('recovers unclosed for-loop aliases with trim markers when template has parse errors', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = [
      '---',
      'invalid: bar: [{% if %}foo {% endif %}]',
      '---',
      '{% set collection = ["a", "b"] %}',
      '{% for x in collection -%}',
      '{{ x }}',
    ].join('\n');
    const offset = text.indexOf('{{ x }}') + 3;

    const result = adapter.resolveLocalAliasDefinition(text, 'x', offset);

    expect(result).not.toBeNull();
    expect(text.slice(result!.start, result!.end)).toBe('x');
  });

  it('expands set-variable bindings without loop-style array coercion', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const text = '{% set foo = user %}{{ foo.name }}';
    const resolved = adapter.resolveScopedPath(text, 'foo.name', text.indexOf('foo.name') + 1);

    expect(resolved).toBe('user.name');
  });

  it('returns null when an alias matches but declaration offsets are missing', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const extractSpy = vi.spyOn(core, 'extractTemplateBindings').mockReturnValue([
      {
        kind: 'for-alias',
        name: 'item',
        scopeStartOffset: 0,
        scopeEndOffset: 20,
      },
    ] as core.TemplateBinding[]);

    try {
      const result = adapter.resolveLocalAliasDefinition('{% for item in users %}', 'item', 5);
      expect(result).toBeNull();
    } finally {
      extractSpy.mockRestore();
    }
  });
});

describe('ContextGraphSemanticReadAdapter.loadSchemaRef', () => {
  it('returns undefined when referenced schema content is not valid JSON', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = createTempDir();
    const basePath = path.join(tempDir, 'base.json');
    const brokenPath = path.join(tempDir, 'broken.json');
    writeFileSync(basePath, JSON.stringify({ type: 'object' }, null, 2));
    writeFileSync(brokenPath, '{ invalid json');

    const result = (adapter as any).loadSchemaRef(
      pathToFileURL(basePath).toString(),
      './broken.json'
    );

    expect(result).toBeUndefined();
  });

  it('returns undefined when a JSON-pointer traversal enters a non-object value', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const tempDir = createTempDir();
    const basePath = path.join(tempDir, 'base.json');
    const schemaPath = path.join(tempDir, 'schema.json');
    writeFileSync(basePath, JSON.stringify({ type: 'object' }, null, 2));
    writeFileSync(schemaPath, JSON.stringify({ scalar: 1 }, null, 2));

    const result = (adapter as any).loadSchemaRef(
      pathToFileURL(basePath).toString(),
      './schema.json#/scalar/deeper'
    );

    expect(result).toBeUndefined();
  });
});
