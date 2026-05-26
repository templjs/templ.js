---
$schema: schemas/work-management/frontmatter/plan.json
id: plan:dynamic-local-inference-two-phase
title: Dynamic Local Inference Two Phase Plan
summary: Deterministic two-phase execution plan to close dynamic local inference gaps across hover, completion, and definition targeting
type: plan
subtype: tactical
lifecycle: inactive
status: closed
status_reason: completed
---

## Plan Overview

## Metadata

- plan_id: dynamic-local-inference-two-phase
- owner: copilot
- repository: templjs/templ.js
- target_branch: staging
- created_at: 2026-05-26T03:07:50Z
- work_item_ids:
  - work-item:147-dynamic-local-inference-hover-completion-foundation
  - work-item:148-dynamic-local-definition-to-literal-targeting

## Scope

- In scope:
  - Phase 1 closure of WI-147 for inferred-path hover and completion authority.
  - Phase 2 closure of WI-148 for inferred definition-to-literal source targeting.
  - Deterministic malformed-template fallback semantics for hover and definition.
- Out of scope:
  - Unrelated parser refactors not required for WI-147 and WI-148 acceptance criteria.
  - Release workflow or CI policy changes outside targeted plan validation steps.

## Dependencies

- WI-148 depends_on WI-147.
- Phase 2 implementation depends_on successful Phase 1 validation.
- Merge depends_on PR creation and green validation gates.

## Phases

- Phase 1: Dynamic local inference for hover and completion (WI-147)
  - step_id: phase-1-analyze-scope (type: analyze)
  - step_id: phase-1-edit-core-semantify (type: edit)
  - step_id: phase-1-edit-volar-read-paths (type: edit)
  - step_id: phase-1-validate (type: validate)
- Phase 2: Definition-to-literal targeting and resilience hardening (WI-148)
  - step_id: phase-2-analyze-definition-targeting (type: analyze)
  - step_id: phase-2-edit-definition-contracts (type: edit)
  - step_id: phase-2-validate (type: validate)
- Delivery and closure sequence
  - step_id: pr-process (type: pr)
  - step_id: merge (type: merge)
  - step_id: finalize (type: finalize)

## Validation Gates

- phase-1-validate:
  - rtk pnpm test --filter @templjs/core --filter @templjs/semantify --filter @templjs/volar
  - rtk pnpm run lint:frontmatter
- phase-2-validate:
  - rtk pnpm test --filter @templjs/semantify --filter @templjs/volar
  - rtk pnpm run lint:frontmatter
  - rtk pnpm test

## Steps

- [x] phase-1-analyze-scope type: analyze
  - action: confirm phase 1 scope, dependency boundaries, and fallback semantics.
- [x] phase-1-edit-core-semantify type: edit
  - action: implement inferred-path metadata and semantic node projection.
- [x] phase-1-edit-volar-read-paths type: edit
  - action: wire inferred-path hover and completion read paths with schema fallback.
- [x] phase-1-validate type: validate
  - commands: see Validation Gates.
- [x] phase-2-analyze-definition-targeting type: analyze
  - action: lock inferred definition precedence and malformed-template confidence thresholds.
- [x] phase-2-edit-definition-contracts type: edit
  - action: implement inferred definition target contracts and resolver precedence.
- [x] phase-2-validate type: validate
  - commands: see Validation Gates.
- [x] pr-process type: pr
  - action: create-or-update-pr
- [x] merge type: merge
  - action: run-process-pr
- [x] finalize type: finalize
  - action: sync-evidence-and-close-loop

## Progress Notes

- 2026-05-26: Implementation phases and PR flow completed, including merge of PR #187 to `staging`.
- 2026-05-26: Finalization complete after adding PR linkage for WI-146 and WI-147 and promoting WI-147/WI-148 to `ready-for-review`.

## Completion Criteria

- Phase 1 validate commands exit 0.
- Phase 2 validate commands exit 0.
- WI-147 and WI-148 moved to ready-for-review with evidence linkage.
- PR merged to staging.
- Required evidence links recorded and synchronized.
