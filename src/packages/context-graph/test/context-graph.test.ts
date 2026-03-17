import { describe, expect, it, vi } from 'vitest';
import { ContextGraphError, createContextGraph, type ContextProvider } from '../src/index.js';

describe('ContextGraphEngine', () => {
  it('supports N providers and deterministic node ordering', async () => {
    const graph = createContextGraph();

    const providerA: ContextProvider = {
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

    const providerB: ContextProvider = {
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

  it('clears provider-owned nodes on re-invalidate', async () => {
    const graph = createContextGraph();
    let counter = 0;

    const provider: ContextProvider = {
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

    const provider: ContextProvider = {
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

    const provider: ContextProvider = {
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

  it('keeps deterministic edge ordering across read APIs', async () => {
    const graph = createContextGraph();
    const provider: ContextProvider = {
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

  it('throws structured error for unsupported query contract version', async () => {
    const graph = createContextGraph();
    const provider: ContextProvider = {
      id: 'provider-version',
      onInvalidate: (_uri, _ctx) => undefined,
    };

    graph.use(provider);
    await graph.invalidate('file:///v');

    try {
      graph.query({ version: 'v2' as never });
      throw new Error('expected query to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ContextGraphError);
      const payload = (error as ContextGraphError).payload;
      expect(payload.code).toBe('invalid-payload');
      expect(payload.version).toBe('v1');
      expect(payload.message).toContain('Unsupported query version');
    }
  });

  it('throws structured provider-failed error payloads', async () => {
    const graph = createContextGraph();
    const provider: ContextProvider = {
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
      expect(error).toBeInstanceOf(ContextGraphError);
      const payload = (error as ContextGraphError).payload;
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
    const onClose = vi.fn(
      (_uri: string, ctx: Parameters<NonNullable<ContextProvider['onClose']>>[1]) => {
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
      }
    );

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
