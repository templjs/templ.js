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

  it('validates helper extension contracts and adapter/profile compatibility', () => {
    const result = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        adapterId: 'unknown-adapter',
      },
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^1.0.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
        helperExtensions: [
          {
            schemaVersion: '1.0.0',
            id: 'broken-helper',
            kind: 'semantic-token-provider',
            consumesSemanticKinds: [],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not declare adapter unknown-adapter')
      )
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('must consume at least one semantic kind')
      )
    ).toBe(true);
  });

  it('emits diagnostics for invalid profile, rule, and helper contract definitions', () => {
    const result = projectSemanticGraph({
      adapterOutput,
      profile: {
        ...profile,
        schemaVersion: '0.9.0' as never,
        semanticKinds: [{ kind: '' as never }, { kind: 'dup.kind' }, { kind: 'dup.kind' }],
        projectionRules: [
          {
            schemaVersion: '0.9.0' as never,
            id: 'dup.rule',
            name: 'Broken rule A',
            version: '1.0.0',
            sourceNodeKind: 'test.symbol',
            targetSemanticKind: 'missing.kind',
            deterministicBehavior: 'strict',
            transformationSteps: [],
          },
          {
            schemaVersion: '1.0.0',
            id: 'dup.rule',
            name: 'Broken rule B',
            version: '1.0.0',
            sourceNodeKind: 'test.symbol',
            targetSemanticKind: 'missing.kind',
            deterministicBehavior: 'strict',
            transformationSteps: [
              { kind: 'canonicalize', description: 'Keep deterministic ordering.' },
            ],
          },
        ],
        helperExtensions: [
          {
            schemaVersion: '0.9.0' as never,
            id: 'invalid-helper',
            kind: 'unsupported-kind' as never,
            consumesSemanticKinds: ['missing.kind'],
            provenance: {
              requireSourceSpan: true,
            },
          },
        ],
      },
    });

    const messages = result.diagnostics.map((diagnostic) => diagnostic.message);
    expect(messages.some((message) => message.includes('Unsupported profile schema version'))).toBe(
      true
    );
    expect(
      messages.some((message) => message.includes('must include a non-empty kind value'))
    ).toBe(true);
    expect(messages.some((message) => message.includes('Duplicate semantic kind definition'))).toBe(
      true
    );
    expect(messages.some((message) => message.includes('unsupported schema version'))).toBe(true);
    expect(
      messages.some((message) => message.includes('must declare at least one transformation step'))
    ).toBe(true);
    expect(messages.some((message) => message.includes('Duplicate projection rule id'))).toBe(true);
    expect(messages.some((message) => message.includes('targets unknown semantic kind'))).toBe(
      true
    );
    expect(
      messages.some((message) => message.includes('has unsupported kind unsupported-kind'))
    ).toBe(true);
    expect(messages.some((message) => message.includes('consumes unknown semantic kind'))).toBe(
      true
    );
    expect(
      messages.some((message) =>
        message.includes('declares provenance requirements for unknown semantic kind')
      )
    ).toBe(true);
  });

  it('reports adapter node kinds that are outside the declared adapter manifest', () => {
    const result = projectSemanticGraph({
      adapterOutput,
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^1.0.0',
            sourceNodeKinds: ['templjs.schema-path'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('is not allowed by profile adapter manifest')
      )
    ).toBe(true);
  });

  it('reports adapter versions that do not satisfy the declared adapter version range', () => {
    const result = projectSemanticGraph({
      adapterOutput,
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^2.0.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);
  });

  it('rejects versions below caret minimum even when major versions match', () => {
    const result = projectSemanticGraph({
      adapterOutput,
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^1.2.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);
  });

  it('enforces zero-major caret semantics for adapter version ranges', () => {
    const zeroMajorMismatch = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        adapterVersion: '0.10.0',
      },
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^0.9.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      zeroMajorMismatch.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);

    const zeroMajorMatch = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        adapterVersion: '0.9.5',
      },
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^0.9.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      zeroMajorMatch.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(false);
  });

  it('rejects prerelease adapter versions unless range explicitly includes prereleases', () => {
    const result = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        adapterVersion: '1.2.0-beta.1',
      },
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^1.2.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);
  });

  it('accepts exact adapter version matches in adapter manifests', () => {
    const result = projectSemanticGraph({
      adapterOutput,
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '1.0.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(false);
  });

  it('reports invalid adapter version ranges when range or version is empty', () => {
    const result = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        adapterVersion: '',
      },
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);
  });

  it('reports invalid adapter versions that are not valid semver strings', () => {
    const result = projectSemanticGraph({
      adapterOutput: {
        ...adapterOutput,
        adapterVersion: 'not-a-semver',
      },
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '^1.0.0',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);
  });

  it('reports invalid adapter version ranges that semver cannot parse', () => {
    const result = projectSemanticGraph({
      adapterOutput,
      profile: {
        ...profile,
        defaultAdapters: [
          {
            adapterId: 'test-adapter',
            adapterVersionRange: '[invalid-range',
            sourceNodeKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('does not satisfy profile adapterVersionRange')
      )
    ).toBe(true);
  });

  it('enforces provenance requirements for helper-consumed semantic kinds', () => {
    const runtime = createProjectionRuntime({
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: () => [
            {
              type: 'node',
              node: {
                id: 'manual-node',
                profileId: 'test-profile',
                kind: 'test.symbol',
                attributes: {
                  label: 'manual',
                },
              } as never,
            },
          ],
        },
      ],
    });

    const result = runtime.project({
      adapterOutput,
      profile: {
        ...profile,
        helperExtensions: [
          {
            schemaVersion: '1.0.0',
            id: 'strict-helper',
            kind: 'semantic-token-provider',
            consumesSemanticKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('consumed by helper strict-helper is missing provenance')
      )
    ).toBe(true);
  });

  it('enforces helper provenance attribute requirements when provenance is present but incomplete', () => {
    const runtime = createProjectionRuntime({
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: () => [
            {
              type: 'node',
              node: {
                id: 'incomplete-provenance-node',
                profileId: 'test-profile',
                kind: 'test.symbol',
                attributes: {
                  label: 'manual',
                },
                provenance: {
                  version: 'v1',
                  providerId: 'manual',
                  providerVersion: '1.0.0',
                  sourceDocId: 'file:///manual',
                  projectionRuleId: 'test.symbol.to-node',
                  targetId: 'incomplete-provenance-node',
                  confidence: 'definite',
                },
              } as never,
            },
          ],
        },
      ],
    });

    const result = runtime.project({
      adapterOutput,
      profile: {
        ...profile,
        helperExtensions: [
          {
            schemaVersion: '1.0.0',
            id: 'strict-helper',
            kind: 'semantic-token-provider',
            consumesSemanticKinds: ['test.symbol'],
          },
        ],
      },
    });

    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('missing provenance sourceSpan')
      )
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('missing provenance attribute profileVersion')
      )
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('missing provenance attribute sourceNodeKind')
      )
    ).toBe(true);
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

  it('produces byte-stable projection snapshots in strict mode', () => {
    const strictOptions = { strictMode: true };
    const first = projectSemanticGraph({ adapterOutput, profile }, strictOptions);
    const second = projectSemanticGraph({ adapterOutput, profile }, strictOptions);

    const firstSerialized = semantifyProjectionTesting.stableSerialize(first);
    const secondSerialized = semantifyProjectionTesting.stableSerialize(second);
    expect(firstSerialized).toBe(secondSerialized);
  });

  it('fails fast in strict mode when provenance is missing or malformed', () => {
    const runtime = createProjectionRuntime({
      strictMode: true,
      rules: [
        {
          ruleId: 'test.symbol.to-node',
          project: () => [
            {
              type: 'node',
              node: {
                id: 'node-without-provenance',
                profileId: 'test-profile',
                kind: 'test.symbol',
                attributes: {},
              } as never,
            },
          ],
        },
      ],
    });

    expect(() => runtime.project({ adapterOutput, profile })).toThrowError(
      /Semantify strict mode validation failed/
    );
    expect(() => runtime.project({ adapterOutput, profile })).toThrowError(
      /missing or malformed|requires provenance/i
    );
  });

  it('reports strict-mode diagnostic violations for deterministic ordering and provenance integrity', () => {
    const diagnostics = semantifyProjectionTesting.collectStrictModeDiagnostics({
      nodes: [
        {
          id: 'z-node',
          profileId: 'profile',
          kind: 'kind-a',
          attributes: {},
        },
        {
          id: 'a-node',
          profileId: 'profile',
          kind: 'kind-a',
          attributes: {},
          provenance: {
            version: 'v1',
            providerId: '',
            providerVersion: '',
            sourceDocId: '',
            projectionRuleId: '',
            targetId: 'a-node',
            sourceSpan: { startOffset: 9, endOffset: 4 },
            attributes: {},
            confidence: 'definite',
          },
        },
      ] as never,
      edges: [
        {
          id: 'z-edge',
          profileId: 'profile',
          from: 'b',
          to: 'a',
          kind: 'edge-kind',
          attributes: {},
        },
        {
          id: 'a-edge',
          profileId: 'profile',
          from: 'a',
          to: 'b',
          kind: 'edge-kind',
          attributes: {},
          provenance: {
            version: 'v1',
            providerId: 'provider',
            providerVersion: '1.0.0',
            sourceDocId: 'doc',
            projectionRuleId: 'rule',
            targetId: 'orphan-target',
            sourceSpan: { startOffset: 1, endOffset: 2 },
            attributes: {
              profileVersion: '1.0.0',
              sourceNodeKind: 'kind-a',
            },
            confidence: 'definite',
          },
        },
      ] as never,
      provenance: [
        {
          version: 'v1',
          providerId: 'provider',
          providerVersion: '1.0.0',
          sourceDocId: 'doc',
          projectionRuleId: 'rule',
          targetId: 'z-edge',
          sourceSpan: { startOffset: 0, endOffset: 1 },
          attributes: {
            profileVersion: '1.0.0',
            sourceNodeKind: 'kind-a',
          },
          confidence: 'definite',
        },
        {
          version: 'v1',
          providerId: '',
          providerVersion: '',
          sourceDocId: '',
          projectionRuleId: '',
          targetId: 'orphan-target',
          sourceSpan: { startOffset: 4, endOffset: 1 },
          attributes: {},
          confidence: 'definite',
        },
        {
          version: 'v1',
          providerId: 'provider',
          providerVersion: '1.0.0',
          sourceDocId: 'doc',
          projectionRuleId: 'rule',
          targetId: 'a-edge',
          sourceSpan: { startOffset: 0, endOffset: 1 },
          attributes: {
            profileVersion: '1.0.0',
            sourceNodeKind: 'kind-a',
          },
          confidence: 'definite',
        },
        {
          version: 'v1',
          providerId: 'provider',
          providerVersion: '1.0.0',
          sourceDocId: 'doc',
          projectionRuleId: 'rule',
          targetId: 'a-edge',
          sourceSpan: { startOffset: 0, endOffset: 1 },
          attributes: {
            profileVersion: '1.0.0',
            sourceNodeKind: 'kind-a',
          },
          confidence: 'definite',
        },
      ] as never,
    });

    const messages = diagnostics.map((diagnostic) => diagnostic.message);
    expect(messages.some((message) => message.includes('deterministically sorted'))).toBe(true);
    expect(messages.some((message) => message.includes('duplicate provenance target'))).toBe(true);
    expect(messages.some((message) => message.includes('with no matching graph entity'))).toBe(
      true
    );
    expect(messages.some((message) => message.includes('requires providerId'))).toBe(true);
    expect(messages.some((message) => message.includes('requires a valid sourceSpan'))).toBe(true);
    expect(messages.some((message) => message.includes('requires provenance attributes'))).toBe(
      true
    );
    expect(
      messages.some((message) =>
        message.includes('requires provenance coverage for every graph entity')
      )
    ).toBe(true);
  });

  it('reports strict-mode diagnostics when inline provenance target ids are swapped', () => {
    const diagnostics = semantifyProjectionTesting.collectStrictModeDiagnostics({
      nodes: [
        {
          id: 'node-a',
          profileId: 'profile',
          kind: 'kind-a',
          attributes: {},
          provenance: {
            version: 'v1',
            providerId: 'provider',
            providerVersion: '1.0.0',
            sourceDocId: 'doc',
            projectionRuleId: 'rule',
            targetId: 'edge-a',
            sourceSpan: { startOffset: 0, endOffset: 1 },
            attributes: {
              profileVersion: '1.0.0',
              sourceNodeKind: 'kind-a',
            },
            confidence: 'definite',
          },
        },
      ] as never,
      edges: [
        {
          id: 'edge-a',
          profileId: 'profile',
          from: 'node-a',
          to: 'node-a',
          kind: 'edge-kind',
          attributes: {},
          provenance: {
            version: 'v1',
            providerId: 'provider',
            providerVersion: '1.0.0',
            sourceDocId: 'doc',
            projectionRuleId: 'rule',
            targetId: 'node-a',
            sourceSpan: { startOffset: 0, endOffset: 1 },
            attributes: {
              profileVersion: '1.0.0',
              sourceNodeKind: 'kind-a',
            },
            confidence: 'definite',
          },
        },
      ] as never,
      provenance: [
        {
          version: 'v1',
          providerId: 'provider',
          providerVersion: '1.0.0',
          sourceDocId: 'doc',
          projectionRuleId: 'rule',
          targetId: 'node-a',
          sourceSpan: { startOffset: 0, endOffset: 1 },
          attributes: {
            profileVersion: '1.0.0',
            sourceNodeKind: 'kind-a',
          },
          confidence: 'definite',
        },
        {
          version: 'v1',
          providerId: 'provider',
          providerVersion: '1.0.0',
          sourceDocId: 'doc',
          projectionRuleId: 'rule',
          targetId: 'edge-a',
          sourceSpan: { startOffset: 0, endOffset: 1 },
          attributes: {
            profileVersion: '1.0.0',
            sourceNodeKind: 'kind-a',
          },
          confidence: 'definite',
        },
      ] as never,
    });

    const messages = diagnostics.map((diagnostic) => diagnostic.message);
    expect(
      messages.some((message) =>
        message.includes('node provenance targetId edge-a to match node id node-a')
      )
    ).toBe(true);
    expect(
      messages.some((message) =>
        message.includes('edge provenance targetId node-a to match edge id edge-a')
      )
    ).toBe(true);
  });
});
