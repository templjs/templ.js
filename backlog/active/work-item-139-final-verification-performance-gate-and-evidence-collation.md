---
'$schema': schemas/work-management/frontmatter/work-item.json
id: work-item:139-final-verification-performance-gate-and-evidence-collation
title: '139: Final Verification, Performance Gate, and Evidence Collation'
summary: Execute final deterministic/projection validation, performance checks, and closure-ready evidence collation for the full cutover lane.
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 6
actual: 0
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

- [ ] Execute package-level validations for Semantify, Volar, language-service, and language-server.
- [ ] Execute repo-level validation commands and record results.
- [ ] Run deterministic graph/provenance repeatability checks on fixed fixtures.
- [ ] Run performance checks for completion, hover, diagnostics, semantic tokens, and formatting orchestration paths.
- [ ] Record evidence pointers and closure notes for `WI-131` through `WI-139` handoff.

## Deliverables

- Final validation report and reproducibility evidence.
- Performance gate results with pass/fail summaries.
- Closure-ready evidence linkage for backlog automation.

## Acceptance Criteria

- [ ] All required validation commands pass.
- [ ] Deterministic projection outputs are reproducible across repeat runs on fixed fixtures.
- [ ] Performance checks show no unacceptable regressions in targeted feature paths.
- [ ] Evidence package is complete for closure automation workflows.

## Relationships

- `depends_on`: [[work-item-138-legacy-artifact-purge-and-api-surface-cleanup]]

## Validation

```bash
pnpm run lint:frontmatter
pnpm run type-check
pnpm run test
pnpm run build
```
