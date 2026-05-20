export type ContractVersion = 'v1';

export type ProviderId = string;
export type NodeId = string;
export type EdgeId = string;
export type ProfileId = string;
export type GraphErrorCode = 'provider-not-registered' | 'provider-failed' | 'invalid-payload';
export type GraphProvenanceConfidence = 'definite' | 'heuristic' | 'synthetic';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export interface SubjectRef {
  id: NodeId;
}

export interface SourceSpan {
  startOffset: number;
  endOffset: number;
}

export interface SourceLocation {
  line: number;
  character: number;
}

export interface GraphProvenance {
  version: ContractVersion;
  providerId: ProviderId;
  providerVersion?: string;
  sourceDocId: string;
  sourceUri?: string;
  sourceSpan: SourceSpan;
  sourceLoc?: SourceLocation;
  projectionRuleId?: string;
  confidence: GraphProvenanceConfidence;
  targetId: NodeId | EdgeId;
  attributes?: JsonObject;
}

export interface ContextNode {
  id: NodeId;
  profileId: ProfileId;
  kind: string;
  attributes?: JsonObject;
  provenance?: GraphProvenance;
}

export interface ContextEdge {
  id: EdgeId;
  profileId: ProfileId;
  from: NodeId;
  to: NodeId;
  kind: string;
  attributes?: JsonObject;
  provenance?: GraphProvenance;
}

export type GraphNode = ContextNode;
export type GraphEdge = ContextEdge;

export interface GraphSnapshot {
  version: ContractVersion;
  revision: number;
  nodes: ContextNode[];
  edges: ContextEdge[];
}

export interface GraphError {
  code: GraphErrorCode;
  message: string;
  providerId?: ProviderId;
}

export interface GraphOperationError extends GraphError {
  version: ContractVersion;
}

export interface GraphDelta {
  version: ContractVersion;
  revision: number;
  type: 'provider-invalidated' | 'provider-closed';
  providerId: ProviderId;
  nodeCount: number;
  edgeCount: number;
}

export interface NodeQuery {
  kind?: string;
  profileIds?: ReadonlyArray<ProfileId>;
  attributeEquals?: Readonly<Record<string, JsonPrimitive>>;
}

export interface EdgeQuery {
  kind?: string;
  profileIds?: ReadonlyArray<ProfileId>;
  from?: NodeId;
  to?: NodeId;
}

export interface QueryRequest {
  version: ContractVersion;
  nodes?: NodeQuery;
  edges?: EdgeQuery;
}

export interface QueryResponse {
  version: ContractVersion;
  revision: number;
  nodes: ContextNode[];
  edges: ContextEdge[];
}

export interface GraphWriteContext {
  upsertNode(node: ContextNode): void;
  upsertEdge(edge: ContextEdge): void;
  removeNode(nodeId: NodeId): void;
  removeEdge(edgeId: EdgeId): void;
}

export interface ContextProvider {
  id: ProviderId;
  onInvalidate(uri: string, ctx: GraphWriteContext): void | Promise<void>;
  onClose?(uri: string, ctx: GraphWriteContext): void | Promise<void>;
}

export interface ContextGraph {
  use(provider: ContextProvider): ContextGraph;
  invalidate(uri: string): Promise<GraphDelta[]>;
  close(uri: string): Promise<GraphDelta[]>;
  getNodes(query?: NodeQuery): ContextNode[];
  getEdges(query?: EdgeQuery): ContextEdge[];
  query(request: QueryRequest): QueryResponse;
  getSnapshot(): GraphSnapshot;
}
