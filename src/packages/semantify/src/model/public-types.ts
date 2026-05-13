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
