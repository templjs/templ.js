---
id: wi-054
type: work-item
subtype: bug
lifecycle: active
title: '054: VS Code extension does not load input schema for schema-aware authoring'
status: closed
status_reason: completed
priority: high
estimated: 8
actual: 4
completed_date: 2026-03-29
assignee: ''
commits:
  8ab845c: 'perf(ide): optimize schema resolution and semantic caches'
  db623c1: 'fix(vscode): surface language client startup failures'
  8ddf67c: 'fix(vscode): avoid rethrow in startup catch'
  74e7070: 'test(vscode): harden activation coverage'
  13a7f34: 'fix(vscode): reload schema-aware diagnostics on schema file changes (WI-054, WI-055)'
test_results:
  - timestamp: 2026-03-11T00:00:00Z
    note: |
      Phase 1 implementation completed:
      - Added VS Code setting `templjs.schemaPath`
      - Passed schema path via extension initialization options
      - Implemented server-side schema file loading and schema URI propagation
      - Added/updated extension + server tests for schema handoff and fallback behavior
      - Targeted tests: 18 passed, 0 failed
  - timestamp: 2026-03-11T01:30:00Z
    note: |
      Phase 2 slice implemented:
      - Added settings `templjs.contentSchemaPath` and glob-based `templjs.schemas`
      - Added HTTP/HTTPS schema loading support with timeout handling
      - Added per-document schema precedence resolver (inline > root > setting, independent per schema type)
      - Added root property extraction for `$templ-schema` and `$content-schema`
      - Added active document context handoff from extension to server
      - Extended plugin options with `contentSchema` and `contentSchemaUri`
      - Added tests for precedence and glob-pattern resolution
      - Targeted tests: 23 passed, 0 failed
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Schema-loading hardening follow-up (8ab845c, db623c1, 8ddf67c):
      - Switched document-relative schema file existence checks to async access in shared schema utils
      - Added timeout-specific URL schema logging and deterministic reload timer flushing in server tests
      - Surfaced language client startup failures through the VS Code UI without rethrowing from a void-discarded promise chain
      - Focused verification:
        - `pnpm --filter vscode-templjs test -- test/server.test.ts` (32 passed)
        - `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)
  - timestamp: 2026-03-17T00:00:00Z
    note: |
      Activation coverage follow-up (74e7070):
      - Added extension tests for non-file document context handling, startup error surfacing,
        and trace-mode middleware logging behavior
      - Revalidated package-local VS Code coverage gate and the shared pre-push hook successfully
  - timestamp: 2026-03-19T00:00:00Z
    note: |
      Checklist reconciliation verification:
      - Ran `src/extensions/vscode/test/server-inprocess.integration.test.ts` (5 passed)
      - Ran `src/packages/volar/test/diagnostic-provider.test.ts` + `src/packages/volar/test/intellisense-provider.test.ts` (121 passed)
      - Verified schema-aware frontmatter/content completions and diagnostics, glob/precedence resolution,
        root schema alias extraction, URL schema loading, and backward compatibility for `templjs.schemaPath`
  - timestamp: 2026-03-22T00:00:00Z
    note: |
      Schema hot-reload + documentation follow-up:
      - Added server-side watched-file handler to invalidate schema cache and republish diagnostics
        for open documents when schema-like files (`.json`, `.yaml`, `.yml`) change on disk
      - Expanded watched template extension coverage for `.tpl.*` variants in server options
      - Updated VS Code extension README with schema configuration, precedence, and hot-reload behavior
      - Verification:
        - `src/extensions/vscode/test/server.test.ts` (41 passed)
        - `src/extensions/vscode/test/server-inprocess.integration.test.ts` (5 passed)
        - Full VS Code extension test set (80 passed)
  - timestamp: 2026-03-27T00:00:00Z
    note: |
      URL cache reuse + directive/docs completion:
      - Added URL schema root-cache reuse in `schema-loading.ts` so repeated fragment loads from the same URL
        reuse parsed content and avoid redundant network fetches
      - Added regression tests for URL cache reuse and first-inline-directive precedence in
        `src/extensions/vscode/test/schema-loading.test.ts`
      - Added regression coverage for non-OK HTTP schema responses and error logging
      - Added regression coverage for missing fetch implementation and sync malformed-schema handling
      - Removed unreachable non-record guard branches in schema loaders to align behavior and coverage gating
      - Expanded README coverage for URL schema behavior, multi-root handling, and troubleshooting
      - Verification:
        - `pnpm run test:affected:pre-push` for `vscode-templjs` (4 files, 98 tests passed)
        - Coverage for `src/extensions/vscode/src/schema-loading.ts`: branches 91.25%
  - timestamp: 2026-03-29T00:00:00Z
    note: |
      Closure validation:
      - Verified dependencies closed: [[031_language_feature_tests]], [[053_validate_schema_input_integration]]
      - Merged PR evidence:
        - https://github.com/templjs/templ.js/pull/27 (all checks successful)
        - https://github.com/templjs/templ.js/pull/32 (all checks successful)
links:
  depends_on:
    - '[[031_language_feature_tests]]'
    - '[[053_validate_schema_input_integration]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/27'
    - 'https://github.com/templjs/templ.js/pull/32'
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

**Phase 2 (New):**

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

### Phase 2 (In Progress)

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
- Server currently creates plugin without full schema wiring (Phase 2 will complete this)
- Volar providers already accept schema options and use SchemaValidator
- Core SchemaValidator already supports metadata extraction and query-path validation
- Existing `stripTemplateSyntax()` and `createMappings()` in Volar plugin handle virtual code generation
- Gray-matter pattern exists in scripts/ci/lint-frontmatter.ts for YAML frontmatter parsing
- Tests currently cover basic schema handoff but not glob patterns, URL loading, directives, frontmatter, or precedence rules (Phase 2 will add these)
