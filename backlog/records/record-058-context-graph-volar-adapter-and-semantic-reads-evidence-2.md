---
$schema: schemas/work-management/frontmatter/record.json
id: record:058-context-graph-volar-adapter-and-semantic-reads-evidence-2
title: '058: Add Volar adapter and migrate semantic reads evidence 2'
summary: '058: Add Volar adapter and migrate semantic reads evidence 2'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.763Z

## Outcome

noted

## Observation

Architecture boundary correction follow-up:

- Repointed Volar semantic-context usage to `@templjs/core` (`resolveSemanticContextBlock` + frontmatter alias helpers)
- Kept `@templjs/context-graph` usage in Volar limited to generic graph contracts
- Focused verification after correction: 129 passed, 0 failed
- Builds reconfirmed: `pnpm --filter @templjs/core build`, `pnpm --filter @templjs/context-graph build`, `pnpm --filter @templjs/volar build`

## Subject References

- [[work-item-058-context-graph-volar-adapter-and-semantic-reads]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
