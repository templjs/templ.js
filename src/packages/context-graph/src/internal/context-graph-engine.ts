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
  nodeKeys: Set<string>;
  edgeKeys: Set<string>;
};

type OrderedRecord<T> = {
  key: string;
  entity: T;
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
function compareByProperties<T>(a: T, b: T, propertyNames: (keyof T)[]): number {
  for (const propName of propertyNames) {
    const aValue = String(a[propName]);
    const bValue = String(b[propName]);
    const compareResult = aValue.localeCompare(bValue);
    if (compareResult !== 0) {
      return compareResult;
    }
  }

  return 0;
}

function compareNodes(a: ContextNode, b: ContextNode): number {
  return compareByProperties(a, b, ['id', 'profileId', 'kind']);
}

function compareEdges(a: ContextEdge, b: ContextEdge): number {
  return compareByProperties(a, b, ['id', 'profileId', 'from', 'to']);
}

function compareNodeRecords(a: OrderedRecord<ContextNode>, b: OrderedRecord<ContextNode>): number {
  return compareNodes(a.entity, b.entity) || a.key.localeCompare(b.key);
}

function compareEdgeRecords(a: OrderedRecord<ContextEdge>, b: OrderedRecord<ContextEdge>): number {
  return compareEdges(a.entity, b.entity) || a.key.localeCompare(b.key);
}

function insertSorted<T>(items: T[], item: T, compare: (left: T, right: T) => number): void {
  let low = 0;
  let high = items.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (compare(items[middle]!, item) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  items.splice(low, 0, item);
}

function removeByKey<T>(items: OrderedRecord<T>[], key: string): void {
  const index = items.findIndex((item) => item.key === key);
  items.splice(index, Number(index >= 0));
}

function scopedEntityKey(providerId: string, entityId: string): string {
  return `${providerId}\u0000${entityId}`;
}

function cloneEntity<T extends ContextNode | ContextEdge>(entity: T): T {
  return JSON.parse(JSON.stringify(entity)) as T;
}

function matchesNodeQuery(node: ContextNode, query: NodeQuery): boolean {
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

function matchesEdgeQuery(edge: ContextEdge, query: EdgeQuery): boolean {
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
  private readonly orderedNodes: OrderedRecord<ContextNode>[] = [];
  private readonly orderedEdges: OrderedRecord<ContextEdge>[] = [];
  private revision = 0;

  use(provider: ContextProvider): ContextGraph {
    this.providers.set(provider.id, provider);
    if (!this.providerStates.has(provider.id)) {
      this.providerStates.set(provider.id, {
        nodeKeys: new Set(),
        edgeKeys: new Set(),
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
      const writeContext = this.createWriteContext(provider.id, state);
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
          await provider.onClose(uri, this.createWriteContext(provider.id, state));
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
    const records = query
      ? this.orderedNodes.filter((record) => matchesNodeQuery(record.entity, query))
      : this.orderedNodes;
    return records.map((record) => cloneEntity(record.entity));
  }

  getEdges(query?: EdgeQuery): ContextEdge[] {
    const records = query
      ? this.orderedEdges.filter((record) => matchesEdgeQuery(record.entity, query))
      : this.orderedEdges;
    return records.map((record) => cloneEntity(record.entity));
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
          `Unsupported query version: received ${String((request as { version?: unknown }).version)}, expected ${CONTRACT_VERSION}`
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

  private createWriteContext(providerId: string, state: ProviderState): GraphWriteContext {
    return {
      upsertNode: (node) => {
        const key = scopedEntityKey(providerId, node.id);
        const storedNode = cloneEntity(node);
        removeByKey(this.orderedNodes, key);
        this.nodes.set(key, storedNode);
        insertSorted(this.orderedNodes, { key, entity: storedNode }, compareNodeRecords);
        state.nodeKeys.add(key);
      },
      upsertEdge: (edge) => {
        const key = scopedEntityKey(providerId, edge.id);
        const storedEdge = cloneEntity(edge);
        removeByKey(this.orderedEdges, key);
        this.edges.set(key, storedEdge);
        insertSorted(this.orderedEdges, { key, entity: storedEdge }, compareEdgeRecords);
        state.edgeKeys.add(key);
      },
      removeNode: (nodeId) => {
        const key = scopedEntityKey(providerId, nodeId);
        removeByKey(this.orderedNodes, key);
        this.nodes.delete(key);
        state.nodeKeys.delete(key);
      },
      removeEdge: (edgeId) => {
        const key = scopedEntityKey(providerId, edgeId);
        removeByKey(this.orderedEdges, key);
        this.edges.delete(key);
        state.edgeKeys.delete(key);
      },
    };
  }

  private getOrCreateProviderState(providerId: string): ProviderState {
    const existing = this.providerStates.get(providerId);
    if (existing) {
      return existing;
    }

    const created: ProviderState = {
      nodeKeys: new Set(),
      edgeKeys: new Set(),
    };
    this.providerStates.set(providerId, created);
    return created;
  }

  private clearProviderState(state: ProviderState): void {
    for (const edgeKey of state.edgeKeys) {
      removeByKey(this.orderedEdges, edgeKey);
      this.edges.delete(edgeKey);
    }
    state.edgeKeys.clear();

    for (const nodeKey of state.nodeKeys) {
      removeByKey(this.orderedNodes, nodeKey);
      this.nodes.delete(nodeKey);
    }
    state.nodeKeys.clear();
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
      nodeCount: state.nodeKeys.size,
      edgeCount: state.edgeKeys.size,
    };
  }
}
