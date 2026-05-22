---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:139-final-verification-performance-gate-and-evidence-collation
title: '139: Final Verification, Performance Gate, and Evidence Collation'
summary: Execute final deterministic/projection validation, performance checks, and closure-ready evidence collation for the full cutover lane.
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: validation-and-evidence-complete
priority: high
estimated: 6
actual: 4
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/177
  evidence:
    - '[[record-20260521-221758-139-final-verification-performance-gate-and-evidence-collation]]'
---

## Goal

Prove final-state readiness for full projection cutover with deterministic reproducibility, performance guardrails, and complete evidence inputs for closure automation.

## Background

After legacy removal, the final lane must validate correctness, determinism, and operational readiness across packages and end-to-end authoring features.

## Scope

- Run final package and repo-level validation matrix.
- Run deterministic reproducibility checks and performance gates.
- Prepare closure-ready evidence references for automation handoff.

## Tasks

- [x] Execute package-level validations for Semantify, Volar, language-service, and language-server.
- [x] Execute repo-level validation commands and record results.
- [x] Run deterministic graph/provenance repeatability checks on fixed fixtures.
- [x] Run performance checks for completion, hover, diagnostics, semantic tokens, and formatting orchestration paths.
- [x] Record evidence pointers and closure notes for `WI-131` through `WI-139` handoff.

## Deliverables

- Final validation report and reproducibility evidence.
- Performance gate results with pass/fail summaries.
- Closure-ready evidence linkage for backlog automation.

## Progress Notes

- 2026-05-22: Completed package-level validation commands with passing results: `pnpm --filter @templjs/semantify test`, `pnpm --filter @templjs/semantify build`, `pnpm --filter @templjs/volar test`, `pnpm --filter @templjs/volar build`, `pnpm --filter @templjs/language-service test`, and `pnpm --filter @templjs/language-server test`.
- 2026-05-22: Completed repo-level validation matrix with all commands passing: `pnpm run lint:frontmatter`, `pnpm run type-check`, `pnpm run test`, and `pnpm run build`.
- 2026-05-22: Verified deterministic projection repeatability using a fixed fixture via `node --import tsx` against `createSemantifyProjectionSnapshot`, producing identical serialized snapshots (`determinism-ok 5 0`).
- 2026-05-22: Ran `pnpm run benchmark:ci` successfully; benchmark outputs were written to `artifacts/benchmarks/benchmark-results.json` and included semantic-path coverage (`volar.diagnostics.document` mean 14.796 ms).
- 2026-05-22: Prepared closure handoff evidence summary for `WI-131` through `WI-139`; work-item close/archive remains assigned to backlog automation.

## Acceptance Criteria

- [x] All required validation commands pass.
- [x] Deterministic projection outputs are reproducible across repeat runs on fixed fixtures.
- [x] Performance checks show no unacceptable regressions in targeted feature paths.
- [x] Evidence package is complete for closure automation workflows.

## Relationships

- `depends_on`: [[work-item-138-legacy-artifact-purge-and-api-surface-cleanup]]

## Validation

```bash
pnpm run lint:frontmatter
pnpm run type-check
pnpm run test
pnpm run build
```
