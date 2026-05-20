import { describe, expect, it } from 'vitest';
import { createSemantifyProjectionSnapshot } from '../src/semantify-projection-adapter.js';

describe('createSemantifyProjectionSnapshot', () => {
  it('creates projected template and schema facts with provenance', () => {
    const snapshot = createSemantifyProjectionSnapshot({
      documentUri: 'file:///example.md.tpl',
      text: '{% for item in users %}{{ item.name }}{% endfor %}',
      contentSchema: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    });

    expect(snapshot.nodes.some((node) => node.kind === 'templjs.binding')).toBe(true);
    expect(snapshot.nodes.some((node) => node.kind === 'templjs.schema-path')).toBe(true);
    expect(snapshot.nodes.every((node) => node.provenance)).toBe(true);
  });
});
