---
'@templjs/language-service': minor
---

<!-- markdownlint-disable MD041 -->

feat(language-service): introduce @templjs/language-service package

Extracts service plugin and schema-loading utilities from the VS Code extension
into a standalone `@templjs/language-service` package, enabling reuse by the
language server and other consumers without a VS Code dependency.

Exported APIs:

- `createTempljsServicePlugins` — factory for all Volar service plugins
- `servicePluginTesting` — test helpers for service plugin unit tests
- `schemaLoading` (default export) — schema-loading utility bundle
- `resolveWorkspaceRoot`, `extractDocumentSchemaKey`,
  `findSchemaConfigForDocument`, `loadSchemaSource`, `loadSchemaSourceSync`,
  `resolveDocumentSchemaSources` — schema resolution utilities
- `DEFAULT_SCHEMA_LOAD_TIMEOUT_MS` — configurable timeout constant
- Types: `InitializeParamsLike`, `SchemaLoadContext`, `SchemaLoadResult`,
  `SchemaLoadSyncContext`, `SchemaPatternConfig`, `ServerInitializationOptions`,
  `DocumentSchemaConfig`, `SchemaPatterns`
