import type { DiagnosticOptions, IntellisenseOptions } from '@templjs/volar';
import type { ServerInitializationOptions } from './schema-loading.js';

export type TempljsHostServiceAdapterId =
  | 'templjs-markdown-host'
  | 'templjs-yaml'
  | 'templjs-html-host'
  | 'templjs-json-host'
  | 'templjs-prettier-host';

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
