export {
  createServicePlugins as createTempljsServicePlugins,
  servicePluginTesting,
} from './service-plugins.js';

export {
  DEFAULT_SCHEMA_LOAD_TIMEOUT_MS,
  extractDocumentSchemaKey,
  findSchemaConfigForDocument,
  loadSchemaSource,
  loadSchemaSourceSync,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
  type InitializeParamsLike,
  type SchemaLoadContext,
  type SchemaLoadResult,
  type SchemaLoadSyncContext,
  type SchemaPatternConfig,
  type ServerInitializationOptions,
} from './schema-loading.js';

export { default as schemaLoading } from './schema-loading.js';

export type DocumentSchemaConfig = import('./schema-loading.js').SchemaPatternConfig;
export type SchemaPatterns = Record<string, import('./schema-loading.js').SchemaPatternConfig>;
