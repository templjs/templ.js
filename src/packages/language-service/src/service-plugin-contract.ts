import type { DiagnosticOptions, IntellisenseOptions } from '@templjs/volar';
import type { ServerInitializationOptions } from './schema-loading.js';

export type ServicePluginRuntimePlanningContext = {
  sourceUri: string;
  sourceText: string;
  sourceLanguageId?: string;
  initializationOptions?: ServerInitializationOptions;
};

export type FormattingOrchestrationEvent = {
  helperExtensionId: string;
  consumesSemanticKinds: string[];
  source: 'manifest';
  adapterId: 'templjs-prettier-host';
  documentUri: string;
  delegatedLanguageId: string;
  configuredHostLanguages: string[];
};

export type ServicePluginOrchestrationOptions = {
  getIntellisenseOptions?: (sourceUri: string, sourceText: string) => IntellisenseOptions;
  getDiagnosticOptions?: (sourceUri: string, sourceText: string) => DiagnosticOptions;
  workspaceFolder?: string;
  initializationOptions?: ServerInitializationOptions;
  schemaCache?: Map<string, unknown>;
  loadSchemaUrlSync?: (url: string) => string | object | undefined;
  onFormattingOrchestration?: (event: FormattingOrchestrationEvent) => void;
  log?: (message: string) => void;
};
