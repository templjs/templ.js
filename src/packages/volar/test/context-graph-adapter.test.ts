import { describe, expect, it } from 'vitest';
import { createContextGraphSemanticReadAdapter } from '../src/context-graph-adapter.js';

const primarySchema = {
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

const secondarySchema = {
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
  it('separates completion candidates by schema source', () => {
    const adapter = createContextGraphSemanticReadAdapter();

    const primary = adapter.getChildCompletions(
      {
        operation: 'completion',
        schemaSource: 'primary',
        documentUri: 'file:///workspace/doc.md.tpl',
        line: 0,
        character: 0,
      },
      '',
      {
        schema: primarySchema,
        contentSchema: secondarySchema,
      }
    );

    const secondary = adapter.getChildCompletions(
      {
        operation: 'completion',
        schemaSource: 'secondary',
        documentUri: 'file:///workspace/doc.md.tpl',
        line: 10,
        character: 2,
      },
      '',
      {
        schema: primarySchema,
        contentSchema: secondarySchema,
      }
    );

    expect(primary.map((item) => item.label)).toEqual(['frontData']);
    expect(secondary.map((item) => item.label)).toEqual(['contentData']);
  });

  it('filters query results by operation from location context', () => {
    const adapter = createContextGraphSemanticReadAdapter();
    const options = { schema: primarySchema, contentSchema: secondarySchema };

    const completionResponse = adapter.query(
      options,
      {
        version: 'v1',
        nodes: {
          kind: 'schema-path',
          attributeEquals: {
            operation: 'completion',
            schemaSource: 'primary',
          },
        },
      },
      {
        operation: 'completion',
        schemaSource: 'primary',
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
            schemaSource: 'primary',
          },
        },
      },
      {
        operation: 'completion',
        schemaSource: 'primary',
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

    const offset = text.indexOf('item.name') + 2;
    const resolved = adapter.resolveScopedPath(text, 'item.name', offset);

    expect(resolved).toBe('items[0].children[0].name');
  });
});
