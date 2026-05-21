import { describe, expect, it, vi } from 'vitest';
import { GraphError, createContextGraph, type Provider } from '../src/index.js';

describe('ContextGraphEngine', () => {
  it('supports N providers and deterministic node ordering', async () => {
    const graph = createContextGraph();

    const providerA: Provider = {
      id: 'provider-a',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({
          id: 'node-z',
          profileId: 'editor-location',
          kind: 'symbol',
          attributes: { source: 'a' },
        });
      },
    };

    const providerB: Provider = {
      id: 'provider-b',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({
          id: 'node-a',
          profileId: 'runtime',
          kind: 'symbol',
          attributes: { source: 'b' },
        });
      },
    };

    graph.use(providerA).use(providerB);
    await graph.invalidate('file:///test.md.tpl');

    const ids = graph.getNodes().map((node) => node.id);
    expect(ids).toEqual(['node-a', 'node-z']);
  });

  it('treats repeated use of the same provider as idempotent registration', async () => {
    const graph = createContextGraph();
    let invalidateCalls = 0;
    const provider: Provider = {
      id: 'provider-a',
      onInvalidate: (_uri, ctx) => {
        invalidateCalls += 1;
        ctx.upsertNode({
          id: 'node-a',
          profileId: 'editor-location',
          kind: 'symbol',
        });
      },
    };

    graph.use(provider).use(provider);
    await graph.invalidate('file:///duplicate-provider');

    expect(invalidateCalls).toBe(1);
    expect(graph.getNodes().map((node) => node.id)).toEqual(['node-a']);
  });

  it('keeps provider contributions isolated when IDs overlap', async () => {
    const graph = createContextGraph();

    graph
      .use({
        id: 'provider-a',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode({
            id: 'shared-node',
            profileId: 'editor-location',
            kind: 'symbol',
            attributes: { source: 'a' },
          });
        },
      })
      .use({
        id: 'provider-b',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode({
            id: 'shared-node',
            profileId: 'runtime',
            kind: 'symbol',
            attributes: { source: 'b' },
          });
        },
      });

    await graph.invalidate('file:///shared');

    const nodes = graph.getNodes().filter((node) => node.id === 'shared-node');
    expect(nodes).toHaveLength(2);
    expect(nodes.map((node) => node.attributes?.source).sort()).toEqual(['a', 'b']);
  });

  it('uses provider-scoped keys as stable ordering tiebreakers', async () => {
    const graph = createContextGraph();
    const registerProvider = (providerId: string, source: string): Provider => ({
      id: providerId,
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({
          id: 'shared-node',
          profileId: 'shared-profile',
          kind: 'symbol',
          attributes: { source },
        });
        ctx.upsertEdge({
          id: 'shared-edge',
          profileId: 'shared-profile',
          from: 'shared-node',
          to: 'shared-node',
          kind: 'self',
          attributes: { source },
        });
      },
    });

    graph.use(registerProvider('provider-b', 'b')).use(registerProvider('provider-a', 'a'));
    await graph.invalidate('file:///ordering-tiebreakers');

    expect(graph.getNodes().map((node) => node.attributes?.source)).toEqual(['a', 'b']);
    expect(graph.getEdges().map((edge) => edge.attributes?.source)).toEqual(['a', 'b']);
  });

  it('clears provider-owned nodes on re-invalidate', async () => {
    const graph = createContextGraph();
    let counter = 0;

    const provider: Provider = {
      id: 'provider-counter',
      onInvalidate: (_uri, ctx) => {
        counter += 1;
        ctx.upsertNode({
          id: `node-${counter}`,
          profileId: 'editor-location',
          kind: 'symbol',
        });
      },
    };

    graph.use(provider);
    await graph.invalidate('file:///a');
    expect(graph.getNodes().map((node) => node.id)).toEqual(['node-1']);

    await graph.invalidate('file:///a');
    expect(graph.getNodes().map((node) => node.id)).toEqual(['node-2']);
  });

  it('supports close lifecycle and returns deterministic snapshot', async () => {
    const graph = createContextGraph();

    const provider: Provider = {
      id: 'provider-close',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({ id: 'node-1', profileId: 'editor-location', kind: 'range' });
        ctx.upsertEdge({
          id: 'edge-1',
          profileId: 'editor-location',
          from: 'node-1',
          to: 'node-1',
          kind: 'self',
        });
      },
    };

    graph.use(provider);
    await graph.invalidate('file:///b');

    const snapshotBefore = graph.getSnapshot();
    expect(snapshotBefore.version).toBe('v1');
    expect(snapshotBefore.nodes.map((node) => node.id)).toEqual(['node-1']);
    expect(snapshotBefore.edges.map((edge) => edge.id)).toEqual(['edge-1']);

    await graph.close('file:///b');

    const snapshotAfter = graph.getSnapshot();
    expect(snapshotAfter.nodes).toEqual([]);
    expect(snapshotAfter.edges).toEqual([]);
  });

  it('supports profile-aware and versioned query contract', async () => {
    const graph = createContextGraph();

    const provider: Provider = {
      id: 'provider-query',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({ id: 'node-editor', profileId: 'editor-location', kind: 'symbol' });
        ctx.upsertNode({ id: 'node-runtime', profileId: 'runtime', kind: 'symbol' });
      },
    };

    graph.use(provider);
    await graph.invalidate('file:///q');

    const response = graph.query({
      version: 'v1',
      nodes: {
        profileIds: ['editor-location'],
      },
    });

    expect(response.version).toBe('v1');
    expect(response.nodes.map((node) => node.id)).toEqual(['node-editor']);
  });

  it('preserves provenance on graph facts without mutating stored state', async () => {
    const graph = createContextGraph();

    graph.use({
      id: 'provider-provenance',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({
          id: 'node-1',
          profileId: 'templjs-authoring',
          kind: 'binding',
          provenance: {
            version: 'v1',
            providerId: 'provider-provenance',
            providerVersion: '1.0.0',
            sourceDocId: 'file:///template.md.tpl',
            sourceSpan: {
              startOffset: 4,
              endOffset: 8,
            },
            projectionRuleId: 'templjs.binding.to-node',
            confidence: 'definite',
            targetId: 'node-1',
          },
        });
      },
    });

    await graph.invalidate('file:///template.md.tpl');

    const node = graph.getNodes()[0];
    expect(node?.provenance).toMatchObject({
      providerId: 'provider-provenance',
      sourceSpan: {
        startOffset: 4,
        endOffset: 8,
      },
    });

    if (node?.provenance) {
      node.provenance.sourceSpan.startOffset = 999;
    }

    expect(graph.getNodes()[0]?.provenance?.sourceSpan.startOffset).toBe(4);
  });

  it('keeps deterministic edge ordering across read APIs', async () => {
    const graph = createContextGraph();
    const provider: Provider = {
      id: 'provider-edges',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({ id: 'a', profileId: 'editor-location', kind: 'node' });
        ctx.upsertNode({ id: 'b', profileId: 'editor-location', kind: 'node' });
        ctx.upsertEdge({
          id: 'edge-z',
          profileId: 'editor-location',
          from: 'a',
          to: 'b',
          kind: 'rel',
        });
        ctx.upsertEdge({
          id: 'edge-a',
          profileId: 'editor-location',
          from: 'b',
          to: 'a',
          kind: 'rel',
        });
      },
    };

    graph.use(provider);
    await graph.invalidate('file:///edges');

    expect(graph.getEdges().map((edge) => edge.id)).toEqual(['edge-a', 'edge-z']);
    expect(graph.query({ version: 'v1' }).edges.map((edge) => edge.id)).toEqual([
      'edge-a',
      'edge-z',
    ]);
  });

  it('maintains deterministic ordering when provider-owned entries are replaced', async () => {
    const graph = createContextGraph();
    let profileId = 'z-profile';

    graph
      .use({
        id: 'provider-a',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode({ id: 'shared', profileId, kind: 'symbol' });
        },
      })
      .use({
        id: 'provider-b',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode({ id: 'shared', profileId: 'm-profile', kind: 'symbol' });
        },
      });

    await graph.invalidate('file:///ordered');
    expect(graph.getNodes().map((node) => node.profileId)).toEqual(['m-profile', 'z-profile']);

    profileId = 'a-profile';
    await graph.invalidate('file:///ordered');
    expect(graph.getNodes().map((node) => node.profileId)).toEqual(['a-profile', 'm-profile']);
  });

  it('updates ordered indexes for same-cycle upserts and explicit removals', async () => {
    const graph = createContextGraph();

    graph
      .use({
        id: 'provider-a',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode({ id: 'node-replace', profileId: 'z-profile', kind: 'symbol' });
          ctx.upsertNode({ id: 'node-remove', profileId: 'm-profile', kind: 'symbol' });
          ctx.upsertNode({ id: 'node-replace', profileId: 'a-profile', kind: 'symbol' });
          ctx.removeNode('node-remove');
          ctx.removeNode('node-missing');

          ctx.upsertEdge({
            id: 'edge-replace',
            profileId: 'z-profile',
            from: 'node-replace',
            to: 'node-replace',
            kind: 'self',
          });
          ctx.upsertEdge({
            id: 'edge-remove',
            profileId: 'm-profile',
            from: 'node-remove',
            to: 'node-remove',
            kind: 'self',
          });
          ctx.upsertEdge({
            id: 'edge-replace',
            profileId: 'a-profile',
            from: 'node-replace',
            to: 'node-replace',
            kind: 'self',
          });
          ctx.removeEdge('edge-remove');
          ctx.removeEdge('edge-missing');
        },
      })
      .use({
        id: 'provider-b',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode({ id: 'node-peer', profileId: 'b-profile', kind: 'symbol' });
          ctx.upsertEdge({
            id: 'edge-peer',
            profileId: 'b-profile',
            from: 'node-peer',
            to: 'node-peer',
            kind: 'self',
          });
        },
      });

    await graph.invalidate('file:///same-cycle');

    expect(graph.getNodes().map((node) => `${node.id}:${node.profileId}`)).toEqual([
      'node-peer:b-profile',
      'node-replace:a-profile',
    ]);
    expect(graph.getEdges().map((edge) => `${edge.id}:${edge.profileId}`)).toEqual([
      'edge-peer:b-profile',
      'edge-replace:a-profile',
    ]);
  });

  it('removes provider-scoped entries by key when providers reuse entity objects', async () => {
    const graph = createContextGraph();
    const reusedNode = { id: 'shared', profileId: 'shared-profile', kind: 'symbol' };
    const reusedEdge = {
      id: 'shared-edge',
      profileId: 'shared-profile',
      from: 'shared',
      to: 'shared',
      kind: 'self',
    };

    graph
      .use({
        id: 'provider-a',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode(reusedNode);
          ctx.upsertEdge(reusedEdge);
          ctx.removeNode('shared');
          ctx.removeEdge('shared-edge');
        },
      })
      .use({
        id: 'provider-b',
        onInvalidate: (_uri, ctx) => {
          ctx.upsertNode(reusedNode);
          ctx.upsertEdge(reusedEdge);
        },
      });

    await graph.invalidate('file:///reused-objects');

    expect(graph.getNodes().map((node) => node.id)).toEqual(['shared']);
    expect(graph.getEdges().map((edge) => edge.id)).toEqual(['shared-edge']);
  });

  it('returns defensive copies so external mutation cannot corrupt ordering', async () => {
    const graph = createContextGraph();
    const inputNode = {
      id: 'node-a',
      profileId: 'profile-a',
      kind: 'symbol',
      attributes: { status: 'draft' },
    };
    const inputEdge = {
      id: 'edge-a',
      profileId: 'profile-a',
      from: 'node-a',
      to: 'node-a',
      kind: 'self',
      attributes: { status: 'draft' },
    };

    graph.use({
      id: 'provider-mutation',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode(inputNode);
        ctx.upsertEdge(inputEdge);
      },
    });

    await graph.invalidate('file:///mutation');

    inputNode.id = 'node-z';
    inputNode.attributes.status = 'published';
    inputEdge.id = 'edge-z';
    inputEdge.attributes.status = 'published';

    const [returnedNode] = graph.getNodes();
    const [returnedEdge] = graph.getEdges();
    returnedNode!.id = 'node-y';
    returnedNode!.attributes!.status = 'reviewed';
    returnedEdge!.id = 'edge-y';
    returnedEdge!.attributes!.status = 'reviewed';

    expect(graph.getNodes()).toEqual([
      {
        id: 'node-a',
        profileId: 'profile-a',
        kind: 'symbol',
        attributes: { status: 'draft' },
      },
    ]);
    expect(graph.getEdges()).toEqual([
      {
        id: 'edge-a',
        profileId: 'profile-a',
        from: 'node-a',
        to: 'node-a',
        kind: 'self',
        attributes: { status: 'draft' },
      },
    ]);
  });

  it('throws structured error for unsupported query contract version', async () => {
    const graph = createContextGraph();
    const provider: Provider = {
      id: 'provider-version',
      onInvalidate: (_uri, _ctx) => undefined,
    };

    graph.use(provider);
    await graph.invalidate('file:///v');

    try {
      graph.query({ version: 'v2' as never });
      throw new Error('expected query to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GraphError);
      const payload = (error as GraphError).payload;
      expect(payload.code).toBe('invalid-payload');
      expect(payload.version).toBe('v1');
      expect(payload.message).toContain('Unsupported query version');
    }
  });

  it('throws structured provider-failed error payloads', async () => {
    const graph = createContextGraph();
    const provider: Provider = {
      id: 'provider-fail',
      onInvalidate: () => {
        throw new Error('boom');
      },
    };

    graph.use(provider);

    try {
      await graph.invalidate('file:///fail');
      throw new Error('expected invalidate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GraphError);
      const payload = (error as GraphError).payload;
      expect(payload.code).toBe('provider-failed');
      expect(payload.providerId).toBe('provider-fail');
      expect(payload.version).toBe('v1');
      expect(payload.message).toContain('boom');
    }
  });

  it('filters nodes and edges by kind, profile, attributes, and endpoints', async () => {
    const graph = createContextGraph();

    graph.use({
      id: 'provider-filter',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({
          id: 'node-a',
          profileId: 'editor-location',
          kind: 'symbol',
          attributes: { status: 'draft', lang: 'md' },
        });
        ctx.upsertNode({
          id: 'node-b',
          profileId: 'runtime',
          kind: 'asset',
          attributes: { status: 'published' },
        });
        ctx.upsertNode({
          id: 'node-c',
          profileId: 'runtime',
          kind: 'asset',
        });
        ctx.upsertEdge({
          id: 'edge-a',
          profileId: 'editor-location',
          from: 'node-a',
          to: 'node-b',
          kind: 'references',
        });
        ctx.upsertEdge({
          id: 'edge-b',
          profileId: 'runtime',
          from: 'node-b',
          to: 'node-a',
          kind: 'renders',
        });
      },
    });

    await graph.invalidate('file:///filters');

    expect(
      graph.getNodes({
        kind: 'symbol',
        profileIds: ['editor-location'],
        attributeEquals: { status: 'draft' },
      })
    ).toHaveLength(1);
    expect(graph.getNodes({ profileIds: ['missing-profile'] })).toEqual([]);
    expect(
      graph.getNodes({ attributeEquals: { status: 'draft' }, profileIds: ['runtime'] })
    ).toEqual([]);
    expect(graph.getEdges({ kind: 'references', from: 'node-a', to: 'node-b' })).toHaveLength(1);
    expect(graph.getEdges({ from: 'node-a', to: 'node-a' })).toEqual([]);
    expect(
      graph.query({
        version: 'v1',
        nodes: { kind: 'asset', profileIds: ['runtime'], attributeEquals: { status: 'published' } },
        edges: { profileIds: ['runtime'], from: 'node-b' },
      })
    ).toMatchObject({
      nodes: [{ id: 'node-b' }],
      edges: [{ id: 'edge-b' }],
    });
  });

  it('supports onClose write operations after clearing provider-owned state', async () => {
    const graph = createContextGraph();
    const onClose = vi.fn((_uri: string, ctx: Parameters<NonNullable<Provider['onClose']>>[1]) => {
      ctx.removeNode('node-before-close');
      ctx.removeEdge('edge-before-close');
      ctx.upsertNode({ id: 'node-after-close', profileId: 'runtime', kind: 'summary' });
      ctx.upsertEdge({
        id: 'edge-after-close',
        profileId: 'runtime',
        from: 'node-after-close',
        to: 'node-after-close',
        kind: 'self',
      });
    });

    graph.use({
      id: 'provider-close-write',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({ id: 'node-before-close', profileId: 'editor-location', kind: 'draft' });
        ctx.upsertEdge({
          id: 'edge-before-close',
          profileId: 'editor-location',
          from: 'node-before-close',
          to: 'node-before-close',
          kind: 'self',
        });
      },
      onClose,
    });

    await graph.invalidate('file:///close');
    const deltas = await graph.close('file:///close');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deltas).toEqual([
      expect.objectContaining({
        type: 'provider-closed',
        providerId: 'provider-close-write',
        nodeCount: 1,
        edgeCount: 1,
      }),
    ]);
    expect(graph.getNodes().map((node) => node.id)).toEqual(['node-after-close']);
    expect(graph.getEdges().map((edge) => edge.id)).toEqual(['edge-after-close']);
  });

  it('wraps onClose failures into structured provider-failed errors', async () => {
    const graph = createContextGraph();

    graph.use({
      id: 'provider-close-fail',
      onInvalidate: (_uri, ctx) => {
        ctx.upsertNode({ id: 'node-1', profileId: 'editor-location', kind: 'symbol' });
      },
      onClose: () => {
        throw 'close failed';
      },
    });

    await graph.invalidate('file:///close-fail');

    await expect(graph.close('file:///close-fail')).rejects.toMatchObject({
      payload: {
        code: 'provider-failed',
        providerId: 'provider-close-fail',
        message: 'close failed',
        version: 'v1',
      },
    });
  });
});
