import { describe, expect, it } from 'vitest';
import {
  createProjectionRuntime,
  projectSemanticGraph,
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
});
