---
$schema: schemas/work-management/frontmatter/record.json
id: record:092-bug-watchfileextensions-reversed-order-evidence-3
title: '092: watchFileExtensions save-refresh verification after WI-094'
summary: save-path diagnostics refresh now confirmed for md templ variants after WI-094 delegation fix
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

Post-WI-094 validation confirms save-path diagnostics refresh behavior for markdown template variants.

Executed:

- `rtk pnpm --dir src/extensions/vscode test -- test/server.test.ts test/server-inprocess.integration.test.ts`

Relevant coverage includes:

- `registers expected templated file extensions in server options`
- `re-publishes diagnostics for open documents when watched schema files change`
- `validates markdown host-language activation for .md.templ, .md.tmpl, and .md.tpl`
- `publishes templjs and host markdown diagnostics together on save`

Result: 2 files passed, 47 tests passed.

## Subject References

- [[work-item-092-bug-watchfileextensions-reversed-order]]
- [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/test/server.test.ts`
- `src/extensions/vscode/test/server-inprocess.integration.test.ts`
