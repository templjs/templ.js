import type { DiagnosticOptions, IntellisenseOptions } from '@templjs/volar';
import type { ServerInitializationOptions } from './schema-loading.js';
import type { TempljsHostServiceAdapterId } from './adapter-runtime-contract.js';

export type ServicePluginRuntimePlanningContext = {
  sourceUri: string;
  sourceText: string;
  sourceLanguageId?: string;
  initializationOptions?: ServerInitializationOptions;
};

export type ServicePluginOrchestrationOptions = {
  getIntellisenseOptions?: (sourceUri: string, sourceText: string) => IntellisenseOptions;
  getDiagnosticOptions?: (sourceUri: string, sourceText: string) => DiagnosticOptions;
  workspaceFolder?: string;
  initializationOptions?: ServerInitializationOptions;
  schemaCache?: Map<string, unknown>;
  loadSchemaUrlSync?: (url: string) => string | object | undefined;
  log?: (message: string) => void;
};
