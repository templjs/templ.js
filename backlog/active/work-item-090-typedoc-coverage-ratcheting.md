---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:090-typedoc-coverage-ratcheting
title: '090: Close TypeDoc Coverage Gap with Incremental Ratchet'
summary: Close TypeDoc Coverage Gap with Incremental Ratchet
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 10
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-090-typedoc-coverage-ratcheting]]'
---

## Goal

Close the remaining JSDoc/TypeDoc documentation coverage gap using a staged, low-risk ratchet path that preserves delivery velocity.

## Background

WI-020 now includes a regression guard that ensures TypeDoc generation succeeds in CI and emits `docs/api/index.html`.

That guard protects API docs generation from breaking but does not yet enforce documentation completeness for the large exported symbol surface.

This work item introduces an incremental path from baseline measurement to enforceable thresholds.

## Incremental Path

1. Baseline: measure exported-symbol documentation coverage for `@templjs/core` and record current baseline.
2. Public API first: require full JSDoc coverage for symbols exported from `src/packages/core/src/index.ts`.
3. Ratchet: add a non-regressive threshold gate based on baseline + delta, and increase in planned steps.
4. Expand scope: include additional core modules once baseline quality is stable.
5. Promote gate: move from advisory threshold to required threshold after two stable PR cycles.

## Tasks

- [ ] Add coverage measurement script for exported symbol JSDoc ratio (`scripts/docs/typedoc-coverage.mjs`)
- [ ] Produce and commit baseline coverage report (`docs/api/coverage-baseline.json` + markdown summary)
- [ ] Define authoritative symbol scope for phase 1 (public exports from `src/packages/core/src/index.ts`)
- [ ] Add CI advisory check that reports current coverage vs baseline for phase 1 scope
- [ ] Add threshold config file with ratchet policy (`docs/api/coverage-policy.json`)
- [ ] Enforce non-regression for phase 1 scope (current >= baseline)
- [ ] Raise threshold to baseline + 10% after docs improvements land
- [ ] Expand coverage scope to include query-engine and schema exports
- [ ] Update contributor docs with required doc-comment standards and examples
- [ ] Add workflow note for warning policy: generation errors block, coverage ratchet policy governs completeness

## Deliverables

- Coverage measurement script and policy config
- Baseline report artifact tracked in repo
- CI advisory coverage report for PRs
- Required non-regression gate for phase 1 scope
- Written rollout playbook for threshold increases and scope expansion

## Acceptance Criteria

- [ ] A reproducible baseline coverage report exists in-repo and is referenced by CI
- [ ] PRs show coverage delta against baseline for phase 1 symbol scope
- [ ] CI fails when phase 1 documented coverage drops below required threshold
- [ ] Threshold ratchet policy is documented and actionable (owner + cadence + target)
- [ ] Public API export set reaches 100% JSDoc coverage in phase 1
- [ ] Scope expansion plan for phase 2 is approved and linked from WI-020

## Dependencies

- Requires: [[work-item-020-documentation]] to remain the umbrella documentation effort

## Notes

- This work item intentionally separates generation correctness from documentation completeness.
- Generation correctness is already guarded in WI-020 via `ci:docs-api`.
- Coverage completeness is gated incrementally to avoid destabilizing unrelated PRs.

## Relationships

- `depends_on`: [[work-item-020-documentation]]
