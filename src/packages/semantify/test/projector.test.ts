import { describe, expect, it } from 'vitest';
import {
  createProjectionRuntime,
  projectSemanticGraph,
  semantifyProjectionTesting,
  type AdapterOutput,
  type ProfileDefinition,
} from '../src/index.js';

const adapterOutput: AdapterOutput = {
  schemaVersion: '1.0.0',
  adapterId: 'test-adapter',
  adapterVersion: '1.0.0',
  sourceDocId: 'file:///example.tpl',
  nodes: [
    {
      kind: 'test.symbol',
      sourceSpan: {
        startOffset: 10,
        endOffset: 15,
      },
      content: {
        label: 'title',
      },
    },
  ],
};

const profile: ProfileDefinition = {
  schemaVersion: '1.0.0',
  id: 'test-profile',
  version: '1.0.0',
  semanticKinds: [
    {
      kind: 'test.symbol',
    },
  ],
  projectionRules: [
    {
      schemaVersion: '1.0.0',
      id: 'test.symbol.to-node',
      name: 'Symbol to node',
      version: '1.0.0',
      sourceNodeKind: 'test.symbol',
      targetSemanticKind: 'test.symbol',
      deterministicBehavior: 'strict',
      transformationSteps: [
        {
          kind: 'canonicalize',
          description: 'Project symbol.',
        },
      ],
    },
  ],
};

describe('SemantifyProjectionRuntime', () => {
  it('projects adapter output to deterministic graph nodes with provenance', () => {
    const first = projectSemanticGraph({ adapterOutput, profile });
    const second = projectSemanticGraph({ adapterOutput, profile });

    expect(first.graph.nodes).toEqual(second.graph.nodes);
    expect(first.graph.nodes).toHaveLength(1);
    expect(first.graph.nodes[0]).toMatchObject({
      profileId: 'test-profile',
      kind: 'test.symbol',
      attributes: {
        label: 'title',
      },
      provenance: {
        providerId: 'test-adapter',
        providerVersion: '1.0.0',
        sourceDocId: 'file:///example.tpl',
        projectionRuleId: 'test.symbol.to-node',
        confidence: 'definite',
      },
    });
    expect(first.provenance[0]?.sourceSpan).toEqual({
      startOffset: 10,
      endOffset: 15,
    });
  });

  it('supports typed projection rules over the declarative rule metadata', () => {
    const runtime = createProjectionRuntime({
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: (sourceNode, context) => [
            {
              type: 'node',
              node: context.createNode({
                sourceNode,
                content: {
                  label: String(sourceNode.content.label).toUpperCase(),
                },
              }),
            },
          ],
        },
      ],
    });

    const result = runtime.project({ adapterOutput, profile });

    expect(result.graph.nodes[0]?.attributes?.label).toBe('TITLE');
  });

  it('emits structured diagnostics for invalid adapter spans', () => {
    const result = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        nodes: [
          {
            kind: 'test.symbol',
            sourceSpan: {
              startOffset: 20,
              endOffset: 10,
            },
            content: {},
          },
        ],
      },
      profile,
    });

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        sourceNodeKind: 'test.symbol',
      }),
    ]);
  });

  it('normalizes serialization and sanitizes non-json values for projected attributes', () => {
    const serialized = semantifyProjectionTesting.stableSerialize({
      b: 2,
      a: [3, { z: undefined, y: true }],
    });

    expect(serialized).toBe('{"a":[3,{"y":true}],"b":2}');

    const runtime = createProjectionRuntime({
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: (sourceNode, context) => [
            {
              type: 'node',
              node: context.createNode({
                sourceNode,
                content: {
                  nested: {
                    keep: 'value',
                    drop: undefined,
                    list: [1, Symbol('x'), () => 'fn'],
                  },
                },
              }),
            },
          ],
        },
      ],
    });

    const result = runtime.project({ adapterOutput, profile });
    const nested = result.graph.nodes[0]?.attributes?.nested as {
      keep: string;
      list: unknown[];
    };

    expect(nested.keep).toBe('value');
    expect(nested.list[1]).toContain('Symbol');
    expect(String(nested.list[2])).toContain('fn');
  });

  it('projects mixed entities with deterministic ordering and preserved provenance metadata', () => {
    const mixedAdapterOutput: AdapterOutput = {
      schemaVersion: '0.9.0' as never,
      adapterId: 'mixed-adapter',
      adapterVersion: '2.1.0',
      sourceDocId: 'file:///mixed.tpl',
      sourceUri: 'file:///mixed.tpl',
      diagnostics: [
        {
          severity: 'warning',
          message: 'adapter warning',
        },
      ],
      nodes: [
        {
          id: 'beta',
          kind: 'test.symbol',
          sourceSpan: { startOffset: 12, endOffset: 20 },
          sourceLoc: { line: 1, character: 2 },
          content: { label: 'beta' },
        },
        {
          id: 'alpha',
          kind: 'test.symbol',
          sourceSpan: { startOffset: 2, endOffset: 9 },
          content: { label: 'alpha' },
        },
      ],
    };

    const runtime = createProjectionRuntime({
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: (sourceNode, context) => {
            const projectedNode = context.createNode({
              sourceNode,
              confidence: 'inferred',
            });

            const fallbackEdge = context.createEdge({
              sourceNode,
              from: `from:${String(sourceNode.id ?? 'none')}`,
              to: `to:${String(sourceNode.id ?? 'none')}`,
              content: {
                relation: 'links',
              },
            });

            return [
              { type: 'node', node: projectedNode },
              { type: 'edge', edge: fallbackEdge },
              {
                type: 'node',
                node: {
                  id: `manual:${String(sourceNode.id ?? 'none')}`,
                  profileId: context.profile.id,
                  kind: 'manual',
                  attributes: {},
                } as never,
              },
            ];
          },
        },
      ],
    });

    const result = runtime.project({
      adapterOutput: mixedAdapterOutput,
      profile,
    });

    expect(result.graph.nodes.length).toBe(4);
    expect(result.graph.edges.length).toBe(2);
    expect(result.graph.nodes.map((node) => node.id)).toEqual(
      [...result.graph.nodes.map((node) => node.id)].sort()
    );
    expect(result.graph.edges.map((edge) => edge.id)).toEqual(
      [...result.graph.edges.map((edge) => edge.id)].sort()
    );
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.message.includes('Unsupported'))
    ).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message === 'adapter warning')).toBe(
      true
    );
    expect(result.provenance.every((item) => item.sourceUri === 'file:///mixed.tpl')).toBe(true);
    expect(result.provenance.some((item) => item.sourceLoc?.line === 1)).toBe(true);
    expect(result.provenance.some((item) => item.confidence === 'inferred')).toBe(true);
  });

  it('serializes undefined values to null fallback in stable serialization helper', () => {
    expect(semantifyProjectionTesting.stableSerialize(undefined)).toBe('null');
  });

  it('sorts nodes and edges deterministically when earlier comparison fields match', () => {
    const runtime = createProjectionRuntime({
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: (sourceNode, context) => {
            const fromId = String(sourceNode.id ?? 'none');
            const viaContextEdge = context.createEdge({
              sourceNode,
              from: 'same-from',
              to: 'same-to',
              kind: 'test.edge',
              attributes: { explicit: true },
            });

            return [
              {
                type: 'node',
                node: {
                  id: 'same-node-id',
                  profileId: fromId === 'first' ? 'a-profile' : 'b-profile',
                  kind: fromId === 'first' ? 'kind-a' : 'kind-b',
                  attributes: {},
                } as never,
              },
              { type: 'edge', edge: viaContextEdge },
              {
                type: 'edge',
                edge: {
                  id: 'same-edge-id',
                  profileId: 'same-profile',
                  from: fromId === 'first' ? 'a-from' : 'b-from',
                  to: fromId === 'first' ? 'a-to' : 'b-to',
                  kind: fromId === 'first' ? 'kind-a' : 'kind-b',
                  attributes: {},
                } as never,
              },
            ];
          },
        },
      ],
    });

    const result = runtime.project({
      adapterOutput: {
        schemaVersion: '1.0.0',
        adapterId: 'sort-adapter',
        adapterVersion: '1.0.0',
        sourceDocId: 'file:///sort.tpl',
        nodes: [
          {
            id: 'first',
            kind: 'test.symbol',
            sourceSpan: { startOffset: 0, endOffset: 3 },
            content: { value: 1 },
          },
          {
            kind: 'test.symbol',
            sourceSpan: { startOffset: 10, endOffset: 14 },
            content: { value: 2 },
          },
        ],
      },
      profile,
    });

    const tiedNodes = result.graph.nodes.filter((node) => node.id === 'same-node-id');
    const tiedEdges = result.graph.edges.filter((edge) => edge.id === 'same-edge-id');

    expect(tiedNodes).toHaveLength(2);
    expect(tiedNodes.map((node) => node.profileId)).toEqual(['a-profile', 'b-profile']);
    expect(tiedEdges).toHaveLength(2);
    expect(tiedEdges.map((edge) => edge.from)).toEqual(['a-from', 'b-from']);
    expect(result.graph.edges.some((edge) => edge.attributes?.explicit === true)).toBe(true);
  });
});
