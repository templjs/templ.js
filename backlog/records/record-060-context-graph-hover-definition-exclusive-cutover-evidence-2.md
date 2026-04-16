---
$schema: schemas/work-management/frontmatter/record.json
id: record:060-context-graph-hover-definition-exclusive-cutover-evidence-2
title: '060: Enforce exclusive context-graph hover/definition resolution evidence 2'
summary: '060: Enforce exclusive context-graph hover/definition resolution evidence 2'
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

Regression stabilization follow-up (74ec91a, 3eef8cb, 1b9ff47):

- Core: strict where() key validation coverage, safe JSON serialization edge cases, CRLF schema-reference offsets
- VSCode tests: switched schema-definition mock URIs to pathToFileURL().href for robust encoding
- Volar tests: removed temporary debug logging and replaced private-method instrumentation with public query assertions
- Focused verification:
  - `pnpm --filter @templjs/core test -- test/query-engine/array-functions.test.ts test/query-engine/query-engine.functions.array.test.ts test/query-engine/query-engine.functions.utility.test.ts test/semantic/semantic-context.test.ts` (30 passed)
  - `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)
  - `pnpm --filter vscode-templjs test -- test/server.test.ts` (32 passed)

## Subject References

- [[work-item-060-context-graph-hover-definition-exclusive-cutover]]
