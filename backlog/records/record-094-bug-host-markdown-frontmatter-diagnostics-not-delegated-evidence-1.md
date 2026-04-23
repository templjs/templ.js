---
$schema: schemas/work-management/frontmatter/record.json
id: record:094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-1
title: '094: host markdown/frontmatter diagnostics delegation evidence 1'
summary: server diagnostics now publish templjs and host markdown diagnostics together
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

Implemented host diagnostics delegation in `src/extensions/vscode/src/server.ts` by combining:

- templjs diagnostics from `collectDiagnostics(...)`
- host-language diagnostics from Volar language service `doValidation(uri)`

on every diagnostics publish cycle for opened/changed/watched documents.

Added regression test coverage in `src/extensions/vscode/test/server.test.ts`:

- `publishes templjs and host markdown diagnostics together on save`

Validation command executed:

- `rtk pnpm --dir src/extensions/vscode test -- test/server.test.ts test/server-inprocess.integration.test.ts`
- Result: 2 files passed, 47 tests passed.

## Subject References

- [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/test/server.test.ts`
- `src/extensions/vscode/test/server-inprocess.integration.test.ts`
