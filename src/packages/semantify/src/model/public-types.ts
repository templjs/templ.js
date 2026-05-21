import type {
  Edge,
  Node,
  Provenance,
  Snapshot,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from '@templjs/context-graph';

export type SemantifySchemaVersion = '1.0.0';

export type RegionKind =
  | 'metadata'
  | 'templateExpression'
  | 'templateStatement'
  | 'embeddedBlock'
  | 'plainText'
  | 'comment'
  | 'unknown';

export interface OffsetRange {
  startOffset: number;
  endOffset: number;
}

export interface SourceLocation {
  line: number;
  character: number;
}

export interface DelimiterConfigInput {
  statementStart?: string;
  statementEnd?: string;
  expressionStart?: string;
  expressionEnd?: string;
  commentStart?: string;
  commentEnd?: string;
}

export type ScopeBindingKind = 'local' | 'custom';

export interface ScopeBinding {
  kind: ScopeBindingKind;
  name: string;
  scopeRange: OffsetRange;
  declarationRange: OffsetRange;
  sourcePath?: string;
  metadata?: Record<string, unknown>;
}

export type SymbolKind = 'localBinding' | 'schemaPath' | 'filterName' | 'keyword' | 'custom';

export interface SymbolRef {
  kind: SymbolKind;
  rawPath: string;
  resolvedPath?: string;
  rootIdentifier?: string;
  propertyPrefix?: string;
  range: OffsetRange;
  metadata?: Record<string, unknown>;
}

export type QueryIntentType =
  | 'symbolCandidates'
  | 'propertyCandidates'
  | 'filterCandidates'
  | 'definitionTarget'
  | 'hoverPayload'
  | 'diagnosticValidation';

export interface QueryIntent {
  type: QueryIntentType;
  typedPrefix?: string;
  basePath?: string;
  symbol?: SymbolRef;
  metadata?: Record<string, unknown>;
}

export interface CandidateItem {
  label: string;
  kind?: string;
  detail?: string;
  documentation?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface SemanticRegion {
  kind: RegionKind;
  range: OffsetRange;
  metadata?: Record<string, unknown>;
}

export interface SemanticContextResolverInput {
  documentUri?: string;
  text: string;
  offset: number;
  delimiters?: DelimiterConfigInput;
  metadata?: Record<string, unknown>;
}

export interface SemanticContext {
  regions: SemanticRegion[];
  activeRegion?: SemanticRegion;
  bindings: ScopeBinding[];
  diagnostics?: string[];
  metadata?: Record<string, unknown>;
}

export interface SemantifyServices {
  resolveContext(input: SemanticContextResolverInput): SemanticContext;
  resolveReferences(input: SemanticContextResolverInput): SymbolRef[];
  planCandidates(intent: QueryIntent, input: SemanticContextResolverInput): CandidateItem[];
}

export type AdapterId = string;
export type ProfileDefinitionId = string;
export type ProjectionRuleId = string;
export type ProjectionDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface AdapterNode {
  id?: string;
  kind: string;
  sourceSpan: OffsetRange;
  sourceLoc?: SourceLocation;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AdapterDiagnostic {
  severity: ProjectionDiagnosticSeverity;
  message: string;
  span?: OffsetRange;
  metadata?: Record<string, unknown>;
}

export interface AdapterOutput {
  schemaVersion: SemantifySchemaVersion;
  adapterId: AdapterId;
  adapterVersion: string;
  sourceDocId: string;
  sourceUri?: string;
  nodes: AdapterNode[];
  diagnostics?: AdapterDiagnostic[];
  metadata?: Record<string, unknown>;
}

export type ProjectionStepKind = 'extract' | 'normalize' | 'canonicalize' | 'enrich' | 'synthesize';

export interface ProjectionStep {
  kind: ProjectionStepKind;
  description: string;
  inputPath?: string;
  outputPath?: string;
  constraints?: Record<string, unknown>;
}

export interface ProjectionRule {
  schemaVersion: SemantifySchemaVersion;
  id: ProjectionRuleId;
  name: string;
  version: string;
  sourceNodeKind: string;
  targetSemanticKind: string;
  deterministicBehavior: 'strict' | 'order-preserving';
  transformationSteps: ProjectionStep[];
}

export interface SemanticKindDefinition {
  kind: string;
  description?: string;
  requiredContentFields?: string[];
  metadata?: Record<string, unknown>;
}

export type ProfileHelperExtensionKind =
  | 'candidate-provider'
  | 'definition-resolver'
  | 'hover-renderer'
  | 'diagnostic-planner'
  | 'semantic-token-provider'
  | 'formatting-orchestrator';

export interface ProjectionProvenanceRequirement {
  requireSourceSpan?: boolean;
  requireProfileVersionAttribute?: boolean;
  requireSourceNodeKindAttribute?: boolean;
}

export interface ProfileHelperExtension {
  schemaVersion: SemantifySchemaVersion;
  id: string;
  kind: ProfileHelperExtensionKind;
  consumesSemanticKinds: string[];
  provenance?: ProjectionProvenanceRequirement;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProfileAdapterManifestEntry {
  adapterId: AdapterId;
  adapterVersionRange: string;
  sourceNodeKinds: string[];
  metadata?: Record<string, unknown>;
}

export interface ProfileDefinition {
  schemaVersion: SemantifySchemaVersion;
  id: ProfileDefinitionId;
  version: string;
  semanticKinds: SemanticKindDefinition[];
  projectionRules: ProjectionRule[];
  helperExtensions?: ProfileHelperExtension[];
  defaultAdapters?: ProfileAdapterManifestEntry[];
  metadata?: Record<string, unknown>;
}

export interface ProjectionDiagnostic {
  severity: ProjectionDiagnosticSeverity;
  message: string;
  adapterId?: AdapterId;
  projectionRuleId?: ProjectionRuleId;
  sourceNodeKind?: string;
  span?: OffsetRange;
  metadata?: Record<string, unknown>;
}

export type SemanticGraphNode = Node;
export type SemanticGraphEdge = Edge;
export type SemanticGraphSnapshot = Snapshot;
export type SemanticGraphProvenance = Provenance;

export interface ProjectionResult {
  schemaVersion: SemantifySchemaVersion;
  graph: SemanticGraphSnapshot;
  diagnostics: ProjectionDiagnostic[];
  provenance: SemanticGraphProvenance[];
  metadata?: Record<string, unknown>;
}

export type ProjectionEntity =
  | { type: 'node'; node: SemanticGraphNode }
  | { type: 'edge'; edge: SemanticGraphEdge };

export interface ProjectionRuleContext {
  profile: ProfileDefinition;
  adapterOutput: AdapterOutput;
  rule: ProjectionRule;
  createNode(input: {
    sourceNode: AdapterNode;
    kind?: string;
    content?: Record<string, unknown>;
    idSuffix?: string;
    attributes?: JsonObject;
    confidence?: SemanticGraphProvenance['confidence'];
  }): SemanticGraphNode;
  createEdge(input: {
    sourceNode: AdapterNode;
    from: string;
    to: string;
    kind?: string;
    content?: Record<string, unknown>;
    idSuffix?: string;
    attributes?: JsonObject;
    confidence?: SemanticGraphProvenance['confidence'];
  }): SemanticGraphEdge;
  toJsonObject(value: Record<string, unknown>): JsonObject;
}

export interface TypedProjectionRule {
  ruleId: ProjectionRuleId;
  project(sourceNode: AdapterNode, context: ProjectionRuleContext): ProjectionEntity[];
}

export interface ProjectionRuntimeInput {
  adapterOutput: AdapterOutput;
  profile: ProfileDefinition;
}

export interface ProjectionRuntimeOptions {
  rules?: TypedProjectionRule[];
}

export type ProjectionJsonObject = JsonObject;
export type ProjectionJsonValue = JsonValue;
export type ProjectionJsonPrimitive = JsonPrimitive;
