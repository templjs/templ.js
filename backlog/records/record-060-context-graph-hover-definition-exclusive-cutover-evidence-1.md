---
$schema: schemas/work-management/frontmatter/record.json
id: record:060-context-graph-hover-definition-exclusive-cutover-evidence-1
title: '060: Enforce exclusive context-graph hover/definition resolution evidence 1'
summary: '060: Enforce exclusive context-graph hover/definition resolution evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.694Z

## Outcome

noted

## Observation

Initial DRY pass and $ref-aware resolution (cb3f6a0):

- createScopedPathResolver() DRY helper shared across completion, hover, definition
- resolveSchemaUriForContext() eliminates duplicate zone-kind logic in adapter
- resolvePathDefinitionAcrossRefs() fallback added to hover path details for $ref parity with definition
- Token-aware hover for for-iterable statement paths (cursor-segment only)
- Remaining: full extension-server cutover and Volar-only LSP forwarding
- Focused tests: 124 passed, 0 failed
- Package builds: @templjs/volar, vscode-templjs confirmed clean

## Subject References

- [[work-item-060-context-graph-hover-definition-exclusive-cutover]]
