---
$schema: schemas/work-management/frontmatter/record.json
id: record:058-context-graph-volar-adapter-and-semantic-reads-evidence-1
title: '058: Add Volar adapter and migrate semantic reads evidence 1'
summary: '058: Add Volar adapter and migrate semantic reads evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.762Z

## Outcome

noted

## Observation

WI-058 implementation verification:

- Added core-backed semantic scope extraction API (`extractTemplateScopeBindings`) and tests
- Added Volar context-graph semantic read adapter with profile-aware schema/query reads
- Routed completion, hover, and definition semantic path reads through graph adapter with fallback preservation
- Added regression tests for nested scope shadowing and mixed frontmatter/content semantic reads
- Focused tests: 90 passed, 0 failed
- Package builds: `pnpm --filter @templjs/core build`, `pnpm --filter @templjs/context-graph build`, `pnpm --filter @templjs/volar build` passed
- Workspace build: `pnpm build` passed (5 projects)

## Subject References

- [[work-item-058-context-graph-volar-adapter-and-semantic-reads]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
