import { describe, expect, it, vi } from 'vitest';

vi.mock('@templjs/semantify', () => {
  let callCount = 0;

  return {
    createTempljsAuthoringProfile: () => ({ id: 'profile' }),
    createTempljsTemplateAdapterOutput: () => ({ kind: 'template' }),
    createTempljsSchemaAdapterOutput: (input: { contextBlock: string }) => input,
    projectSemanticGraph: () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          graph: {
            version: 'v1',
            revision: 2,
            nodes: [{ id: 'b-node', profileId: 'p', kind: 'templjs.binding' }],
            edges: [{ id: 'z-edge', sourceId: 's', targetId: 't', kind: 'templjs.ref' }],
          },
        };
      }
      if (callCount === 2) {
        return {
          graph: {
            version: 'v1',
            revision: 5,
            nodes: [{ id: 'a-node', profileId: 'p', kind: 'templjs.schema-path' }],
            edges: [{ id: 'a-edge', sourceId: 's2', targetId: 't2', kind: 'templjs.ref' }],
          },
        };
      }
      return {
        graph: {
          version: 'v1',
          revision: 3,
          nodes: [{ id: 'a-node', profileId: 'p', kind: 'templjs.schema-path' }],
          edges: [{ id: 'm-edge', sourceId: 's3', targetId: 't3', kind: 'templjs.ref' }],
        },
      };
    },
  };
});

describe('semantify-projection-adapter merge branches', () => {
  it('merges and sorts nodes/edges while using the max revision', async () => {
    const { createSemantifyProjectionSnapshot } =
      await import('../src/semantify-projection-adapter.js');

    const snapshot = createSemantifyProjectionSnapshot({
      text: '{{ x }}',
      schema: { type: 'object', properties: { x: { type: 'string' } } },
      contentSchema: { type: 'object', properties: { y: { type: 'string' } } },
    });

    expect(snapshot.revision).toBe(5);
    expect(snapshot.nodes.map((node) => node.id)).toEqual(['a-node', 'b-node']);
    expect(snapshot.edges.map((edge) => edge.id)).toEqual(['a-edge', 'm-edge', 'z-edge']);
  });
});
