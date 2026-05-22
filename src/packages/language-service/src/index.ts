export {
  createServicePlugins as createTempljsServicePlugins,
  registerCoreServicePlugin,
  unregisterCoreServicePlugin,
  listCoreServicePluginKeys,
  listCoreServicePluginFactories,
  servicePluginTesting,
} from './service-plugins.js';

export type { CoreServicePluginFactory, CoreServicePluginKey } from './service-plugins.js';

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

export type {
  ServicePluginOrchestrationOptions,
  ServicePluginRuntimePlanningContext,
} from './service-plugin-contract.js';

export type {
  AdapterRuntimeProviderKind,
  AdapterRuntimeRequirement,
  AdapterRuntimeCapability,
  AdapterRuntimeManifest,
  AdapterRuntimeManifestEntry,
  AdapterRuntimeMap,
  AdapterRuntimeProvider,
  AdapterRuntimeRequirements,
  AdapterRuntimeResolution,
  AdapterRuntimeResolutionMode,
  AdapterRuntimeResolutionState,
  TempljsHostServiceAdapterId,
} from './adapter-runtime-contract.js';

export {
  ADAPTER_RUNTIME_CAPABILITIES,
  ADAPTER_RUNTIME_PROVIDER_KINDS,
} from './adapter-runtime-contract.js';

export {
  getFormattingExtensionIds,
  getFormattingLanguageConfigurationKeys,
  getSupportedFormattingHostLanguages,
  getConfiguredFormattingHostLanguages,
  registerAdapterRuntimeEntry,
  unregisterAdapterRuntimeEntry,
  getAdapterRuntimeEntry,
  listAdapterRuntimeEntries,
  resolveAdapterRuntimeMapFromRegistry,
} from './adapter-registry.js';

export {
  registerHostAdapterPlugin,
  unregisterHostAdapterPlugin,
  getHostAdapterPluginFactory,
  listHostAdapterPluginKeys,
  type HostAdapterPluginFactory,
  type HostAdapterPluginRegistryKey,
} from './host-adapter-plugin-registry.js';

export {
  getResolvedAdapterRuntime,
  resolveAdapterRuntimeManifest,
  resolveFormattingOrchestrationContract,
} from './runtime-manifest.js';
export type DocumentSchemaConfig = import('./schema-loading.js').SchemaPatternConfig;
export type SchemaPatterns = Record<string, import('./schema-loading.js').SchemaPatternConfig>;
