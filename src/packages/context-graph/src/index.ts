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
  GraphOperationError,
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
  SubjectRef,
} from './public-types.js';

export function createContextGraph(): ContextGraph {
  return new ContextGraphEngine();
}

export { ContextGraphError };
