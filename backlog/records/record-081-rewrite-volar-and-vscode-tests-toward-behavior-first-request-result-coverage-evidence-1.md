---
$schema: schemas/work-management/frontmatter/record.json
id: record:081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage-evidence-1
title: '081: Remove legacy skipped VS Code bootstrap tests evidence 1'
summary: Removed 14 obsolete skipped bootstrap tests from server.test.ts; focused VS Code suites pass with 46 tests
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-23T00:00:00.000Z

## Outcome

passed

## Observation

Removed 14 legacy `it.skip(...)` cases from `src/extensions/vscode/test/server.test.ts` after confirming they targeted the retired mock-dispatch path that no longer exists in `src/extensions/vscode/src/server.ts`.

The remaining bootstrap suite now covers only live wiring, schema-loading, cache, and reload behavior, while request/result authoring behavior stays covered in `test/server-inprocess.integration.test.ts`.

### Validation Results

`pnpm --dir src/extensions/vscode test -- test/server.test.ts test/server-inprocess.integration.test.ts`

- **46 passed, 0 failed**

`src/extensions/vscode/test/server.test.ts`

- No remaining `it.skip(...)` cases in the legacy bootstrap suite

## Subject References

- [[work-item-081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage]]

## Artifact References

- `src/extensions/vscode/test/server.test.ts`
- `src/extensions/vscode/test/server-inprocess.integration.test.ts`
- `src/extensions/vscode/src/server.ts`
