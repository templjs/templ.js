---
$schema: schemas/work-management/frontmatter/record.json
id: record:054-bug-no-schema-aware-authoring-evidence-7
title: '054: VS Code extension does not load input schema for schema-aware authoring evidence 7'
summary: '054: VS Code extension does not load input schema for schema-aware authoring evidence 7'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.759Z

## Outcome

noted

## Observation

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

## Subject References

- [[work-item-054-bug-no-schema-aware-authoring]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/32>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
