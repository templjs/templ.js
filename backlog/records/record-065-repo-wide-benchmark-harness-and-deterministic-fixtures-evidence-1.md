---
$schema: schemas/work-management/frontmatter/record.json
id: record:065-repo-wide-benchmark-harness-and-deterministic-fixtures-evidence-1
title: '065: Establish Repo-Wide Benchmark Harness and Deterministic Fixtures evidence 1'
summary: '065: Establish Repo-Wide Benchmark Harness and Deterministic Fixtures evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.766Z

## Outcome

noted

## Observation

Implemented the first repo-wide benchmark harness with deterministic fixtures and JSON/markdown output.
Validation:

- `pnpm --filter @templjs/core test -- test/semantic/semantic-context.test.ts` (13 passed)
- `pnpm --filter vscode-templjs test -- test/server.test.ts` (32 passed)
- `pnpm benchmark:ci -- --output /tmp/templjs-benchmark-results.json --summary-output /tmp/templjs-benchmark-summary.md`
- `pnpm benchmark:summary -- --input /tmp/templjs-benchmark-results.json --output /tmp/templjs-benchmark-summary-regenerated.md`
- `pnpm benchmark:compare -- --baseline /tmp/templjs-benchmark-results.json --candidate /tmp/templjs-benchmark-results.json --output /tmp/templjs-benchmark-comparison.json --markdown /tmp/templjs-benchmark-comparison.md`
  Notes:
- Added deterministic core, Volar, VS Code, and context-graph fixtures plus machine-readable result/comparison schemas.
- Fixed frontmatter schema alias parsing so `#/$defs/...` fragments survive document-scoped schema resolution in benchmark fixtures.

## Subject References

- [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/29>
- <https://github.com/templjs/templ.js/pull/30>
