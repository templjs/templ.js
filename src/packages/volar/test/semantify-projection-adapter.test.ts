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

  it('creates template-only snapshots without schema overlays', () => {
    const snapshot = createSemantifyProjectionSnapshot({
      text: '{{ user.name }}',
    });

    expect(snapshot.version).toBe('v1');
    expect(snapshot.revision).toBeGreaterThanOrEqual(0);
    expect(snapshot.nodes.length).toBeGreaterThan(0);
  });

  it('uses schema as content fallback and keeps sorted deterministic node order', () => {
    const schema = {
      type: 'object',
      properties: {
        zeta: { type: 'string' },
        alpha: { type: 'string' },
      },
    };

    const snapshot = createSemantifyProjectionSnapshot({
      documentUri: 'file:///fallback.md.tpl',
      text: '{{ alpha }}',
      schema,
    });

    const ids = snapshot.nodes.map((node) => node.id);
    const sorted = [...ids].sort((left, right) => left.localeCompare(right));
    expect(ids).toEqual(sorted);
    expect(snapshot.nodes.some((node) => node.kind === 'templjs.schema-path')).toBe(true);
  });
});
