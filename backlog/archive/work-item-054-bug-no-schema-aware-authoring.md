---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:054-bug-no-schema-aware-authoring
title: '054: VS Code extension does not load input schema for schema-aware authoring'
summary: VS Code extension does not load input schema for schema-aware authoring
type: work-item
subtype: bug
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 8
actual: 4
commits:
  8ab845c: 'perf(ide): optimize schema resolution and semantic caches'
  db623c1: 'fix(vscode): surface language client startup failures'
  8ddf67c: 'fix(vscode): avoid rethrow in startup catch'
  13a7f34: 'fix(vscode): reload schema-aware diagnostics on schema file changes (WI-054, WI-055)'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/27
    - https://github.com/templjs/templ.js/pull/32
    - https://github.com/templjs/templ.js/pull/42
    - https://github.com/templjs/templ.js/pull/43
  evidence:
    - '[[record-054-bug-no-schema-aware-authoring-evidence-1]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-2]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-3]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-4]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-5]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-6]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-7]]'
    - '[[record-054-bug-no-schema-aware-authoring-evidence-8]]'
---

## Goal

Enable schema-aware autocomplete, variable-path diagnostics, and Markdown content validation in VS Code authoring by loading and wiring input schemas (templ-schema and content-schema) in the extension/server runtime. Support multiple schema sources with explicit precedence rules and glob-pattern-based configuration for multi-schema workspaces.

## Bug Summary

Schema-aware logic exists in core and Volar providers, but the VS Code extension path does not currently discover/load schema files and pass them into language feature options. This leaves schema-backed completions and validation inactive in the editor. Additionally, Markdown documents with separate frontmatter and content schemas cannot be validated independently.

## Reproduction Steps

1. Start the extension development host for templjs.
2. Open a templjs file such as `sample.md.templ` with a schema defined in workspace settings or frontmatter.
3. Add expressions like `{{ user.name }}` and typoed paths like `{{ usr.name }}`.
4. Observe missing schema-driven completions/suggestions and path diagnostics.
5. For Markdown files: observe content-schema not applied to Markdown body separately from templ-schema.

## Expected Behavior

- Workspace schema(s) are loaded automatically (via settings, inline directives, or frontmatter).
- Completion/hover/definition include schema-derived metadata.
- Invalid variable paths produce diagnostics with suggestions.
- Markdown files can specify independent templ-schema and content-schema.
- Schema loading from HTTPS URLs is supported.
- Schema changes on disk update editor behavior without full restart.
- Multiple inline directives per document are supported for flexible schema application.

## Actual Behavior

- No schema is loaded or propagated in extension/server initialization (Phase 1 partially fixes this).
- Schema-aware language features are effectively disabled in normal VS Code authoring flow.
- No support for content-schema or Markdown body validation.
- Settings only support single filesystem path.
- Multi-schema workspaces require per-file configuration.

## Scope

**Phase 1 (Completed):**

- VS Code extension configuration for single schema source
- Client→server schema handoff via initialization options
- Server-side schema loading from filesystem (path resolve, parse, validation)
- Pass loaded schema and schema URI into plugin options
- Basic tests for schema handoff

**Phase 2 (Completed):**

- Extended VS Code settings: glob-pattern-based configuration and content-schema paths
- HTTPS/HTTP URL schema loading with timeout and error handling
- Multiple inline `{{# schema: }}` and `{{# content-schema: }}` directives per document
- Root property extraction (`$templ-schema` and `$content-schema` from frontmatter/document)
- Per-document schema resolution with three-way independent precedence (inline > root > setting)
- Frontmatter zone-aware validation (templ-schema for frontmatter, content-schema for Markdown body)
- Volar feature wiring for completion/diagnostics with schema context
- Schema file watcher for hot reload without server restart
- Comprehensive tests and documentation

## Tasks (Resolution Plan)

### Phase 1 (Completed)

- [x] Add extension settings for schema source (`templjs.schemaPath`)
- [x] Read settings in extension activation and include schema config in initialization options
- [x] Implement server-side schema loader (path resolve, parse, validation, error surfacing)
- [x] Pass loaded schema and schema URI into language feature pipeline
- [x] Add/extend tests for schema handoff and schema-aware editor behavior

### Phase 2 (Completed)

- [x] Extend VS Code settings schema with glob-pattern-based `templjs.schema` object and `templjs.contentSchemaPath` setting
- [x] Update extension to parse glob patterns and match document URIs to schema configuration
- [x] Implement HTTPS/HTTP URL schema loading in server with 5s timeout and graceful error handling
- [x] Add `parseSchemaDirective()` function to extract `{{# schema: }}` and `{{# content-schema: }}` from document content
- [x] Add `extractFrontmatterSchemas()` function to parse YAML/JSON frontmatter and extract `$templ-schema` and `$content-schema` root properties
- [x] Implement `resolveDocumentSchema()` function for per-document three-way precedence (inline > root > setting) applied independently to templ and content schemas
- [x] Extend Volar plugin options types to include `contentSchema` and `contentSchemaUri`
- [x] Add frontmatter zone detection and content-schema zone-aware validation in diagnostic provider
- [x] Wire schema into completion/hover/diagnostic execution path (create service-plugin if not present)
- [x] Add file watcher for schema file changes and implement hot reload (cache invalidation, diagnostics refresh)
- [x] Add/extend tests for all new features: glob patterns, URL loading, directives, frontmatter, precedence rules, content-schema validation
- [x] Update extension documentation with setup, glob patterns, content-schema usage, inline directives, root properties, URL schemas, multi-root workspace handling, and troubleshooting

## Acceptance Criteria

**Phase 1 (Completed):**

- [x] Schema setting is read from VS Code configuration
- [x] Schema is passed via LSP initialization options
- [x] Server loads schema from filesystem path without crashing
- [x] Loaded schema is passed to Volar plugin

**Phase 2:**

- [x] With configured schema, top-level and nested path completions appear in templjs files
- [x] Invalid schema paths in expressions and for-in clauses produce diagnostics with suggestions
- [x] Glob-pattern-based settings correctly match documents to different schemas per directory
- [x] HTTPS URL schemas are loaded and cached (content reused on reconnect)
- [x] Multiple inline directives per document are parsed and first match takes precedence
- [x] Root properties (`$templ-schema` and `$content-schema`) are extracted from YAML/JSON frontmatter
- [x] Three-way precedence (inline > root > setting) is applied independently to each schema type
- [x] Markdown files with content-schema have Markdown body validated against content-schema (frontmatter against templ-schema)
- [x] Schema changes on disk update editor behavior without requiring extension restart
- [x] Network failures, missing files, and parse errors yield clear, non-crashing diagnostics/logging
- [x] Backward compatibility: existing `templjs.schemaPath` setting continues to work
- [x] All new tests pass in CI for schema-aware extension behavior
- [x] Documentation covers: glob patterns, content-schema usage, inline directives, root properties, URL schemas, multi-root workspace handling

## Evidence / References

- Extension initialization currently only passes TypeScript SDK options (Phase 1 added schema options)
- Server-side plugin schema wiring is fully implemented and validated through integration tests
- Volar providers already accept schema options and use SchemaValidator
- Core SchemaValidator already supports metadata extraction and query-path validation
- Existing `stripTemplateSyntax()` and `createMappings()` in Volar plugin handle virtual code generation
- Gray-matter pattern exists in scripts/ci/lint-frontmatter.ts for YAML frontmatter parsing
- Tests now cover glob patterns, URL loading, directives, frontmatter extraction, and schema precedence rules

## Relationships

- `depends_on`: [[work-item-031-language-feature-tests]]
- `depends_on`: [[work-item-053-validate-schema-input-integration]]
