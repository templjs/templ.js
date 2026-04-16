---
$schema: schemas/work-management/frontmatter/record.json
id: record:034-prerelease-coverage-quality-gate-evidence-5
title: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 5'
summary: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 5'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.745Z

## Outcome

noted

## Observation

WI-034 final critical-path completion and PR packaging:

- Closed remaining Volar per-file coverage gaps with targeted branch suites and helper-safe refactors
- Revalidated full package coverage with strict per-file enforcement
- Pre-push gate passed (lint frontmatter, eslint, type-check, affected tests)
- Final package summaries from pre-push run:
  - `@templjs/core`: Stmts 99.39%, Branches 97.32%, Funcs 100.00%, Lines 99.42%
  - `@templjs/context-graph`: Stmts 97.00%, Branches 91.66%, Funcs 100.00%, Lines 96.80%
  - `@templjs/volar`: Stmts 98.35%, Branches 92.89%, Funcs 99.13%, Lines 98.34%
  - `vscode-templjs`: Stmts 96.32%, Branches 90.12%, Funcs 96.73%, Lines 96.47%
  - `@templjs/cli`: Stmts 97.54%, Branches 90.96%, Funcs 100.00%, Lines 97.53%

## Subject References

- [[work-item-034-prerelease-coverage-quality-gate]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/32>
