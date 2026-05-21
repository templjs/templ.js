export type ContractVersion = 'v1';

export type ProviderId = string;
export type NodeId = string;
export type EdgeId = string;
export type ProfileId = string;
export type ErrorCode = 'provider-not-registered' | 'provider-failed' | 'invalid-payload';
export type ProvenanceConfidence = 'definite' | 'heuristic' | 'synthetic';

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

export interface Provenance {
  version: ContractVersion;
  providerId: ProviderId;
  providerVersion?: string;
  sourceDocId: string;
  sourceUri?: string;
  sourceSpan: SourceSpan;
  sourceLoc?: SourceLocation;
  projectionRuleId?: string;
  confidence: ProvenanceConfidence;
  targetId: NodeId | EdgeId;
  attributes?: JsonObject;
}

export interface Node {
  id: NodeId;
  profileId: ProfileId;
  kind: string;
  attributes?: JsonObject;
  provenance?: Provenance;
}

export interface Edge {
  id: EdgeId;
  profileId: ProfileId;
  from: NodeId;
  to: NodeId;
  kind: string;
  attributes?: JsonObject;
  provenance?: Provenance;
}

export interface Snapshot {
  version: ContractVersion;
  revision: number;
  nodes: Node[];
  edges: Edge[];
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  providerId?: ProviderId;
}

export interface OperationError extends ErrorPayload {
  version: ContractVersion;
}

export interface Delta {
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
  nodes: Node[];
  edges: Edge[];
}

export interface WriteContext {
  upsertNode(node: Node): void;
  upsertEdge(edge: Edge): void;
  removeNode(nodeId: NodeId): void;
  removeEdge(edgeId: EdgeId): void;
}

export interface Provider {
  id: ProviderId;
  onInvalidate(uri: string, ctx: WriteContext): void | Promise<void>;
  onClose?(uri: string, ctx: WriteContext): void | Promise<void>;
}

export interface Graph {
  use(provider: Provider): Graph;
  invalidate(uri: string): Promise<Delta[]>;
  close(uri: string): Promise<Delta[]>;
  getNodes(query?: NodeQuery): Node[];
  getEdges(query?: EdgeQuery): Edge[];
  query(request: QueryRequest): QueryResponse;
  getSnapshot(): Snapshot;
}
