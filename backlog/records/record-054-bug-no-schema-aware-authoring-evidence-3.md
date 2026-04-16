---
$schema: schemas/work-management/frontmatter/record.json
id: record:054-bug-no-schema-aware-authoring-evidence-3
title: '054: VS Code extension does not load input schema for schema-aware authoring evidence 3'
summary: '054: VS Code extension does not load input schema for schema-aware authoring evidence 3'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.758Z

## Outcome

noted

## Observation

Schema-loading hardening follow-up (8ab845c, db623c1, 8ddf67c):

- Switched document-relative schema file existence checks to async access in shared schema utils
- Added timeout-specific URL schema logging and deterministic reload timer flushing in server tests
- Surfaced language client startup failures through the VS Code UI without rethrowing from a void-discarded promise chain
- Focused verification:
  - `pnpm --filter vscode-templjs test -- test/server.test.ts` (32 passed)
  - `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)

## Subject References

- [[work-item-054-bug-no-schema-aware-authoring]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/32>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
