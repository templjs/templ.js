---
$schema: schemas/work-management/frontmatter/record.json
id: record:034-prerelease-coverage-quality-gate-evidence-2
title: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 2'
summary: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 2'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.744Z

## Outcome

noted

## Observation

Coverage remediation branch follow-up:

- Added targeted regression suites for core semantic helpers, context-graph lifecycle/query filtering,
  Volar schema/expression/scope utilities, and VS Code activation tracing/startup handling
- Isolated per-package coverage output directories to stop parallel pre-push coverage artifact collisions
- Revalidated the full pre-push gate successfully after remediation
- Final gate summary:
  - `@templjs/core`: Stmts 96.05%, Branches 90.50%, Funcs 99.40%, Lines 96.25%
  - `@templjs/context-graph`: Stmts 97.00%, Branches 91.66%, Funcs 100.00%, Lines 96.80%
  - `@templjs/volar`: Stmts 85.14%, Branches 71.92%, Funcs 94.57%, Lines 85.33%
  - `vscode-templjs`: Stmts 83.61%, Branches 70.02%, Funcs 91.11%, Lines 83.67%
  - `@templjs/cli`: Stmts 96.32%, Branches 88.29%, Funcs 100.00%, Lines 96.30%

## Subject References

- [[work-item-034-prerelease-coverage-quality-gate]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/32>
