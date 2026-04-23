---
$schema: schemas/work-management/frontmatter/record.json
id: record:092-bug-watchfileextensions-reversed-order-evidence-1
title: '092: watchFileExtensions reversed order fix — test evidence 1'
summary: watchFileExtensions corrected to forward-order suffixes; 51/51 server tests pass
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-22T00:00:00.000Z

## Outcome

passed

## Observation

Fix applied to `src/extensions/vscode/src/server.ts`:

- `watchFileExtensions` array corrected from reversed suffixes (e.g. `.templ.md`) to forward-order suffixes (e.g. `.md.templ`) — 15 entries total, grouped by base format then marker.
- Corresponding expectation in `src/extensions/vscode/test/server.test.ts` updated to match.

### Test Results

`pnpm --filter vscode-templjs test` — `src/extensions/vscode/test/server.test.ts`:

- **51 passed, 0 failed**

Includes the `watchFileExtensions` test case that explicitly asserts all 15 forward-order suffix values.

### Build Result

`pnpm build` — all 5 projects succeeded, zero errors:

- `dist/extension.js` 790.4 KB
- `dist/server.js` 1.5 MB

## Subject References

- [[work-item-092-bug-watchfileextensions-reversed-order]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/test/server.test.ts`
