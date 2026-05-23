import type { JSONSchema } from '@templjs/core';
import type { DelimiterConfig } from './template-delimiters.js';

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
}

export interface DiagnosticPosition {
  line: number;
  character: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export interface SemanticDiagnosticRecord {
  message: string;
  range: DiagnosticRange;
  severity: DiagnosticSeverity;
  code?: string;
  source?: string;
  suggestion?: string;
}

export type TemplateDelimiters = DelimiterConfig;

export interface DiagnosticOptions {
  documentUri?: string;
  schema?: JSONSchema;
  contentSchema?: JSONSchema;
  customFilters?: string[];
  delimiters?: Partial<TemplateDelimiters>;
  baseSyntaxDiagnostics?: SemanticDiagnosticRecord[];
}
