export type TempljsSourceFileKind = 'template' | 'partial' | 'fragment';

export type TempljsHostLanguage = 'markdown' | 'json' | 'yaml' | 'html' | 'plaintext';

export type TempljsGeneratedCodePurpose =
  | 'host-delegation'
  | 'template-semantics'
  | 'type-semantics'
  | 'metadata-validation';

export type TempljsDocumentSnapshotId = string;

export interface TempljsSemanticZoneRef {
  id: string;
  kind: 'metadata' | 'content' | 'template';
  segment: 'metadata' | 'content';
  startOffset: number;
  endOffset: number;
}

export interface TempljsSchemaSourceRef {
  id: string;
  kind: 'workspace-setting' | 'inline-directive' | 'frontmatter-field' | 'default';
  source: string;
  uri?: string;
}

export interface TempljsParseDiagnosticRef {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'information';
  startOffset: number;
  endOffset: number;
}

export interface TempljsDelimiterConfig {
  blockOpen: string;
  blockClose: string;
  expressionOpen: string;
  expressionClose: string;
  commentOpen: string;
  commentClose: string;
}

export interface TempljsVirtualDocumentMetadata {
  snapshotId: TempljsDocumentSnapshotId;
  sourceFileKind: TempljsSourceFileKind;
  hostLanguage: TempljsHostLanguage;
  delimiters: TempljsDelimiterConfig;
  semanticZones: TempljsSemanticZoneRef[];
  schemaSources: TempljsSchemaSourceRef[];
  parseDiagnostics: TempljsParseDiagnosticRef[];
  contextGraphSnapshotId?: string;
}

export interface TempljsLanguageServerInitializationOptions {
  traceMode?: 'off' | 'messages' | 'verbose';
  workspaceFolder?: string;
  schemaPath?: string;
  contentSchemaPath?: string;
  schemaPatterns?: string[];
}
