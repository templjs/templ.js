---
$schema: schemas/work-management/frontmatter/record.json
id: record:068-remove-remaining-volar-statement-semantic-duplication-evidence-1
title: '068: Remove remaining Volar statement-semantic duplication evidence'
summary: Captures WI-068 validation for moving remaining statement-semantic parsing from Volar providers to shared @templjs/core helpers.
type: record
subtype: evidence
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-05-13T00:00:00.000Z

## Outcome

passed

## Observation

### Implementation Summary

- Added shared statement-semantic helpers in `@templjs/core`:
  - `validateTemplateStatementSyntax`
  - `parseTemplateForHeader`
  - `extractTemplateStatementExpression`
- Replaced Volar-local statement semantic parsing in:
  - diagnostics provider (`diagnostic-provider.ts`)
  - intellisense provider (`intellisense-provider.ts`)
- Preserved existing white-box helper surface in Volar by delegating through thin wrappers.

### Validation Evidence

- `rtk pnpm --filter @templjs/core test`
  - passed (`32` test files, `1506` tests passed, `1` skipped)
- `rtk pnpm --filter @templjs/volar test`
  - passed (`18` test files, `581` tests)
- Focused semantic regression suite:
  - `core/test/semantic/statement-syntax.test.ts`
  - `volar/test/diagnostic-provider.test.ts`
  - `volar/test/intellisense-provider.test.ts`
  - `volar/test/intellisense-provider.branches.test.ts`
  - `volar/test/custom-delimiters.e2e.test.ts`
  - passed (`250` tests, `0` failed)
- `rtk pnpm --filter @templjs/core build && rtk pnpm --filter @templjs/volar build`
  - passed
- `rtk pnpm benchmark:ci -- --output /tmp/wi-068-benchmark-results.json --summary-output /tmp/wi-068-benchmark-summary.md`
  - passed
- `rtk pnpm benchmark:compare -- --baseline artifacts/benchmarks/benchmark-results.json --candidate /tmp/wi-068-benchmark-results.json --output /tmp/wi-068-benchmark-comparison.json --markdown /tmp/wi-068-benchmark-comparison.md`
  - completed with informational comparison (policy non-blocking)

### Benchmark Notes

- `core.schema-analysis` improved (`-23.3%` mean latency)
- `volar.diagnostics.document` regressed (`+19.7%` mean latency)
- Policy remains informational; no benchmark gate failure triggered.

## Subject References

- [[work-item-068-remove-remaining-volar-statement-semantic-duplication]]

## Artifact References

- [Core statement syntax helpers](../../src/packages/core/src/semantic/statement-syntax.ts)
- [Core exports](../../src/packages/core/src/index.ts)
- [Volar diagnostics provider](../../src/packages/volar/src/diagnostic-provider.ts)
- [Volar intellisense provider](../../src/packages/volar/src/intellisense-provider.ts)
- [Core statement syntax tests](../../src/packages/core/test/semantic/statement-syntax.test.ts)
