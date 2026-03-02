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

## WI-007 AST Renderer ([007_ast_renderer.md](../../backlog/archive/007_ast_renderer.md))

### Phase A: Status normalization

- [x] Use `update-work-item` to move this item out of closed before additional work.
      Evidence: WI reopened from archive on 2026-03-02, transitioned through `in-progress` during refactor session. Commits 9b976b1 (operator precedence fix), ccfdbe3 (parser extraction), f4e879a (test config fix), 913ee9b (edge case tests), a9aeb34 (JSDoc). Closed via commit 3cb2940, archived via commit b5cd723.

### Phase B: Implementation and verification

- [x] Add/fix verification for the coverage threshold claim and rerun focused coverage checks.
      Evidence: Comprehensive coverage verification completed. Final metrics: parser.ts 90.87% (256/277 statements, 146/171 branches), parsers.ts 96.25%, evaluators.ts 89.29%, renderer.ts 86.76%. Test suite: 876 tests passing (312 parser, 37 renderer unit, 145 renderer integration, 42 edge cases, 27 filter, 45 variable resolver, 207 lexer, 62 schema). All packages passing: @templjs/core (876/876), @templjs/cli (8/8), @templjs/volar (187/187), vscode-templjs (8/8). Command used: `pnpm test:affected:ci` and `cd src/packages/core && npx vitest run --coverage`.

### Phase C: Checklist audit rerun

- [x] Execute remaining scope via `executing-backlog`, then rerun checklist audit.
      Evidence: All acceptance criteria verified and documented in commit 3cb2940. Renderer deliverables complete: AST renderer with evaluator delegation, variable resolution with filters, control flow (if/else/loops/ternary), error handling, scope management, performance <20ms for 100 iterations, comprehensive JSDoc. Work item moved to `status: closed`, `status_reason: success`, `completed_date: 2026-03-02`, archived to `backlog/archive/007_ast_renderer.md` via commit b5cd723.

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

| Date       | Work Item | Audit Result | Remaining Unchecked | Notes                                                        |
| :--------- | :-------- | :----------- | ------------------: | :----------------------------------------------------------- |
| 2026-03-02 | WI-007    | COMPLETE     |                   0 | 876 tests passing, 85%+ coverage. Archived (commit b5cd723). |

## Command and Skill Reference

- `update-work-item`: Use for status transitions before and during reconciliation execution.
- `executing-backlog`: Use to execute remaining scoped implementation tasks per work item.
- `auditing-backlog-checkboxes`: Use after implementation to validate checklist evidence and remaining unchecked items.
- Coverage/test commands for WI-007/008/011: `cd src/packages/core && pnpm test:coverage`, plus focused package tests as needed.
