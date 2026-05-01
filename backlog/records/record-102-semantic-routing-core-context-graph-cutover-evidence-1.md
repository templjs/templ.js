---
$schema: schemas/work-management/frontmatter/record.json
id: record:102-semantic-routing-core-context-graph-cutover-evidence-1
title: '102: Semantic routing core/context-graph cutover evidence'
summary: Stage 5 alias definition lookups routed through ContextGraphSemanticReadAdapter; local findLocalAliasDefinitionInText removed from IntellisenseProvider
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Summary

Stage 5 of the Volar target architecture migration: routed all local alias definition lookups through the `ContextGraphSemanticReadAdapter`, removing direct `findLocalAliasDefinitionInText` calls from `IntellisenseProvider`.

## Changes

- `src/packages/volar/src/context-graph-adapter.ts`: Added `resolveLocalAliasDefinition(text, alias, offset)` method to `ContextGraphSemanticReadAdapter` using `extractTemplateScopeBindings` and `TemplateScopeBinding.declarationStartOffset/declarationEndOffset`.
- `src/packages/volar/src/intellisense-provider.ts`: Extended `SemanticReadAdapter` Pick to include `resolveLocalAliasDefinition`; replaced 2 direct `findLocalAliasDefinitionInText` calls with `this.semanticReadAdapter.resolveLocalAliasDefinition(...)`; removed `findLocalAliasDefinitionInText` from imports.
- `src/packages/volar/test/context-graph-adapter.test.ts`: Added 4 parity suites for `resolveLocalAliasDefinition` (default delimiters, out-of-scope, no-match, prefix-path).
- `src/packages/volar/test/intellisense-provider.branches.test.ts`: Updated mock adapter to include `resolveLocalAliasDefinition: () => null`; updated alias definition integration test to use `createContextGraphSemanticReadAdapter()`.
- `src/packages/volar/test/intellisense-provider.test.ts`: Updated mock adapter to include `resolveLocalAliasDefinition: () => null`.

## Test Results

- `@templjs/volar`: 524 tests passed (19 test files), 0 failures
- `vscode-templjs` extension: 88 tests passed (8 test files), 0 failures

## Acceptance Criteria Status

- [x] Completion/hover/definition/diagnostics use the same semantic snapshot authority (adapter-first routing for all operations).
- [x] No new regex-based semantic parsing introduced in Volar or VS Code layers.
- [x] Existing behavior-critical authoring suites remain green after local alias fallback removal.
