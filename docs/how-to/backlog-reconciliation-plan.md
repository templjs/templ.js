---
id: howto-001
type: document
subtype: runbook
lifecycle: active
status: ready
title: 'Backlog Reconciliation Plan'
---

This tracker captures reopening, implementation, verification, and checkbox-audit closure for WI-007, WI-008, WI-011, and WI-024.

## How to Use

Use this file as an execution tracker for reconciliation work. It does not replace source-of-truth work item records in `backlog/`.

## Execution Model

1. Phase A: Status normalization (`update-work-item` transitions before changes)
2. Phase B: Implementation and verification
3. Phase C: Checklist audit rerun (`auditing-backlog-checkboxes`)

For WI-011 and WI-024, a review gate is required while in `proposed`; the user sets status to `ready` before implementation resumes.

## WI-007 AST Renderer ([007_ast_renderer.md](../../backlog/007_ast_renderer.md))

### Phase A: Status normalization

- [ ] Use `update-work-item` to move this item out of closed before additional work.
      Evidence:

### Phase B: Implementation and verification

- [ ] Add/fix verification for the coverage threshold claim and rerun focused coverage checks.
      Evidence:

### Phase C: Checklist audit rerun

- [ ] Execute remaining scope via `executing-backlog`, then rerun checklist audit.
      Evidence:

## WI-008 Query Engine ([008_query_engine.md](../../backlog/008_query_engine.md))

### Phase A: Status normalization

- [ ] Use `update-work-item` to move this item out of closed before further implementation.
      Evidence:

### Phase B: Implementation and verification

- [ ] Implement missing query-engine behavior (variable index resolution, built-in registration, argument/type validation).
      Evidence:
- [ ] Add/fix verification with dedicated query-engine tests and a measurable filter-chain performance benchmark.
      Evidence:

### Phase C: Checklist audit rerun

- [ ] Execute remaining scope via `executing-backlog`, then rerun checklist audit.
      Evidence:

## WI-011 Renderer Tests ([011_renderer_tests.md](../../backlog/011_renderer_tests.md))

### Phase A: Status normalization and review gate

- [ ] Use `update-work-item` to move this item to `proposed` before further revision.
      Evidence:
- [ ] Clarify/rewrite the ambiguous functions-directory checkbox into verifiable subclaims.
      Evidence:
- [ ] Prompt for user review. User will set status to `ready` once approved.
      Evidence:
- [ ] Use `update-work-item` to move this item to `in-progress` before further implementation.
      Evidence:

### Phase B: Implementation and verification

- [ ] Implement/link the missing renderer/query-engine test file locations in this work item.
      Evidence:
- [ ] Add/fix verification for per-category test volume, coverage thresholds, and performance targets.
      Evidence:

### Phase C: Checklist audit rerun

- [ ] Execute remaining scope via `executing-backlog`, then rerun checklist audit.
      Evidence:

## WI-024 Work Item Guardrails ([024_work_item_guardrails.md](../../backlog/024_work_item_guardrails.md))

### Phase A: Status normalization and review gate

- [ ] Use `update-work-item` to move this item to `proposed` before further revision.
      Evidence:
- [ ] Clarify/rewrite the normalization checkbox into explicit, verifiable checks.
      Evidence:
- [ ] Prompt for user review. User will set status to `ready` once approved.
      Evidence:
- [ ] Use `update-work-item` to move this item to `in-progress` before further implementation.
      Evidence:

### Phase B: Implementation and verification

- [ ] Implement/link remaining guardrail code for dependency gating semantics and skill-enforced workflow constraints.
      Evidence:
- [ ] Add/fix verification for merged-PR/CI validation (not just PR/test field presence).
      Evidence:

### Phase C: Checklist audit rerun

- [ ] Execute remaining scope via `executing-backlog`, then rerun checklist audit.
      Evidence:

## Verification and Closure Criteria

- [ ] `pnpm run lint:frontmatter` passes.
- [ ] Targeted tests/coverage/benchmark evidence captured for affected work items.
- [ ] Rerun of `auditing-backlog-checkboxes` completed.
- [ ] Each work item has no unresolved reconciliation warnings before re-closing.

## Audit Rerun Log

| Date | Work Item | Audit Result | Remaining Unchecked | Notes |
| :--- | :-------- | :----------- | ------------------: | :---- |
|      |           |              |                     |       |

## Command and Skill Reference

- `update-work-item`: Use for status transitions before and during reconciliation execution.
- `executing-backlog`: Use to execute remaining scoped implementation tasks per work item.
- `auditing-backlog-checkboxes`: Use after implementation to validate checklist evidence and remaining unchecked items.
- Coverage/test commands for WI-007/008/011: `cd src/packages/core && pnpm test:coverage`, plus focused package tests as needed.
