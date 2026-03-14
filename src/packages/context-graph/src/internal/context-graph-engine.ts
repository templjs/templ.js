import type {
  ContextEdge,
  ContextGraph,
  ContextNode,
  ContextProvider,
  EdgeQuery,
  GraphDelta,
  GraphOperationError,
  GraphWriteContext,
  NodeQuery,
  QueryRequest,
} from '../public-types.js';

type ProviderState = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

const CONTRACT_VERSION = 'v1' as const;

function createOperationError(
  code: GraphOperationError['code'],
  message: string,
  providerId?: string
): GraphOperationError {
  return {
    version: CONTRACT_VERSION,
    code,
    message,
    providerId,
  };
}

export class ContextGraphError extends Error {
  readonly payload: GraphOperationError;

  constructor(payload: GraphOperationError) {
    super(payload.message);
    this.name = 'ContextGraphError';
    this.payload = payload;
  }
}

function sortNodes(nodes: ContextNode[]): ContextNode[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortEdges(edges: ContextEdge[]): ContextEdge[] {
  return [...edges].sort((left, right) => left.id.localeCompare(right.id));
}

function matchesNodeQuery(node: ContextNode, query?: NodeQuery): boolean {
  if (!query) return true;
  if (query.kind && node.kind !== query.kind) {
    return false;
  }
  if (
    query.profileIds &&
    query.profileIds.length > 0 &&
    !query.profileIds.includes(node.profileId)
  ) {
    return false;
  }

  const attributeEquals = query.attributeEquals;
  if (!attributeEquals) {
    return true;
  }

  const attrs = node.attributes ?? {};
  for (const [key, value] of Object.entries(attributeEquals)) {
    if (attrs[key] !== value) {
      return false;
    }
  }

  return true;
}

function matchesEdgeQuery(edge: ContextEdge, query?: EdgeQuery): boolean {
  if (!query) return true;
  if (query.kind && edge.kind !== query.kind) {
    return false;
  }
  if (
    query.profileIds &&
    query.profileIds.length > 0 &&
    !query.profileIds.includes(edge.profileId)
  ) {
    return false;
  }
  if (query.from && edge.from !== query.from) {
    return false;
  }
  if (query.to && edge.to !== query.to) {
    return false;
  }
  return true;
}

export class ContextGraphEngine implements ContextGraph {
  private readonly providers = new Map<string, ContextProvider>();
  private readonly providerStates = new Map<string, ProviderState>();
  private readonly nodes = new Map<string, ContextNode>();
  private readonly edges = new Map<string, ContextEdge>();
  private revision = 0;

  use(provider: ContextProvider): ContextGraph {
    this.providers.set(provider.id, provider);
    if (!this.providerStates.has(provider.id)) {
      this.providerStates.set(provider.id, {
        nodeIds: new Set(),
        edgeIds: new Set(),
      });
    }

    return this;
  }

  async invalidate(uri: string): Promise<GraphDelta[]> {
    const deltas: GraphDelta[] = [];

    for (const provider of this.providers.values()) {
      const state = this.getOrCreateProviderState(provider.id);
      // Invalidate performs a full provider-owned rebuild: clear previous
      // contributions before onInvalidate repopulates via the write context.
      this.clearProviderState(state);
      const writeContext = this.createWriteContext(state);
      try {
        await provider.onInvalidate(uri, writeContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ContextGraphError(createOperationError('provider-failed', message, provider.id));
      }
      // Revision advances per provider lifecycle event so each emitted delta
      // has a unique monotonic revision.
      this.revision += 1;
      deltas.push(this.createDelta(provider.id, 'provider-invalidated', state));
    }

    return deltas;
  }

  async close(uri: string): Promise<GraphDelta[]> {
    const deltas: GraphDelta[] = [];

    for (const provider of this.providers.values()) {
      const state = this.getOrCreateProviderState(provider.id);
      // Mirror invalidate semantics: clear provider-owned graph entities first,
      // then let onClose observe/mutate a fresh write context if needed.
      this.clearProviderState(state);

      if (provider.onClose) {
        try {
          await provider.onClose(uri, this.createWriteContext(state));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new ContextGraphError(
            createOperationError('provider-failed', message, provider.id)
          );
        }
      }

      // Revision advances per provider lifecycle event so each emitted delta
      // has a unique monotonic revision.
      this.revision += 1;
      deltas.push(this.createDelta(provider.id, 'provider-closed', state));
    }

    return deltas;
  }

  getNodes(query?: NodeQuery): ContextNode[] {
    const nodes = Array.from(this.nodes.values()).filter((node) => matchesNodeQuery(node, query));
    return sortNodes(nodes);
  }

  getEdges(query?: EdgeQuery): ContextEdge[] {
    const edges = Array.from(this.edges.values()).filter((edge) => matchesEdgeQuery(edge, query));
    return sortEdges(edges);
  }

  getSnapshot() {
    return {
      version: CONTRACT_VERSION,
      revision: this.revision,
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
  }

  query(request: QueryRequest) {
    if (request.version !== CONTRACT_VERSION) {
      throw new ContextGraphError(
        createOperationError(
          'invalid-payload',
          `Unsupported query version: ${String((request as { version?: unknown }).version)}`
        )
      );
    }

    return {
      version: CONTRACT_VERSION,
      revision: this.revision,
      nodes: this.getNodes(request.nodes),
      edges: this.getEdges(request.edges),
    };
  }

  private createWriteContext(state: ProviderState): GraphWriteContext {
    return {
      upsertNode: (node) => {
        this.nodes.set(node.id, node);
        state.nodeIds.add(node.id);
      },
      upsertEdge: (edge) => {
        this.edges.set(edge.id, edge);
        state.edgeIds.add(edge.id);
      },
      removeNode: (nodeId) => {
        this.nodes.delete(nodeId);
        state.nodeIds.delete(nodeId);
      },
      removeEdge: (edgeId) => {
        this.edges.delete(edgeId);
        state.edgeIds.delete(edgeId);
      },
    };
  }

  private getOrCreateProviderState(providerId: string): ProviderState {
    const existing = this.providerStates.get(providerId);
    if (existing) {
      return existing;
    }

    const created: ProviderState = {
      nodeIds: new Set(),
      edgeIds: new Set(),
    };
    this.providerStates.set(providerId, created);
    return created;
  }

  private clearProviderState(state: ProviderState): void {
    for (const edgeId of state.edgeIds) {
      this.edges.delete(edgeId);
    }
    state.edgeIds.clear();

    for (const nodeId of state.nodeIds) {
      this.nodes.delete(nodeId);
    }
    state.nodeIds.clear();
  }

  private createDelta(
    providerId: string,
    type: GraphDelta['type'],
    state: ProviderState
  ): GraphDelta {
    return {
      version: CONTRACT_VERSION,
      revision: this.revision,
      type,
      providerId,
      nodeCount: state.nodeIds.size,
      edgeCount: state.edgeIds.size,
    };
  }
}
