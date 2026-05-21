import { ContextGraphEngine, GraphError } from './internal/context-graph-engine.js';
import type { Graph } from './public-types.js';

export type {
  ContractVersion,
  Delta,
  Edge,
  EdgeId,
  EdgeQuery,
  ErrorCode,
  ErrorPayload,
  Graph,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  Node,
  NodeId,
  NodeQuery,
  OperationError,
  ProfileId,
  Provenance,
  ProvenanceConfidence,
  Provider,
  ProviderId,
  QueryRequest,
  QueryResponse,
  Snapshot,
  SourceLocation,
  SourceSpan,
  SubjectRef,
  WriteContext,
} from './public-types.js';

export function createContextGraph(): Graph {
  return new ContextGraphEngine();
}

export { GraphError };
