import { ContextGraphEngine, ContextGraphError } from './internal/context-graph-engine.js';
import type { ContextGraph } from './public-types.js';

export type {
  ContextEdge,
  ContextGraph,
  ContextNode,
  ContextProvider,
  ContractVersion,
  EdgeId,
  EdgeQuery,
  GraphDelta,
  GraphError,
  GraphErrorCode,
  GraphEdge,
  GraphOperationError,
  GraphNode,
  GraphProvenance,
  GraphProvenanceConfidence,
  GraphSnapshot,
  GraphWriteContext,
  ProfileId,
  QueryRequest,
  QueryResponse,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  NodeId,
  NodeQuery,
  ProviderId,
  SourceLocation,
  SourceSpan,
  SubjectRef,
} from './public-types.js';

export function createContextGraph(): ContextGraph {
  return new ContextGraphEngine();
}

export { ContextGraphError };
