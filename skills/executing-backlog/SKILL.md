---
name: executing-backlog
description: 'Orchestrate the full lifecycle of implementing backlog work items from planning through delivery. Use when asked to "execute backlog", "implement work items", "work on backlog", "deliver features", or "close out a work item".'
---

# Execute Backlog

## Allowed Tools

- `terminal` for shell commands
- `git` for repository operations
- `pnpm` for scripts/tests
- `gh` for GitHub interactions

Use no other tools unless the user explicitly authorizes them in the request.

## When to Use this Skill

- Request explicitly names work item IDs (WI-XXX) or describes a backlog task
- Need end-to-end delivery from planning through merge/finalization
- Coordinating multi-phase work (parallel tickets, blockers, release gating)
- Answering "Start working on WI-ABC" / "Execute backlog" / "Close WI-XYZ"

## Clarification Gate

If the request lacks a concrete work item, dependencies, acceptance criteria, or target branch, stop and ask for the missing details. Do **not** proceed until the user supplies:

1. The WI identifier(s) or a well-defined feature description.
2. Existing blockers/dependencies that might delay execution.
3. Desired outcomes (tests, documentation, release step).

Every response here should reference the dependency graph defined in `skills/auditing-backlog/SKILL.md` (Phases 2-4) as the single source for dependency validation before making implementation decisions.

## Mandatory Planning Output (before acting)

Before modifying the repository, publish an explicit plan that includes: a summary sentence, the sequence of phases, the dependency status, required tests/commands, and the next merge/cleanup tasks. Use this template and fill with concrete values:

```
Plan Summary: <short goal>
Work Items: <WI list + dependencies (closed/pending)>
Scope Boundaries: <single active WI for this branch/PR + explicit out-of-scope items>
Execution Phases: 1) Audit/dependencies 2) Branch/implement/test 3) PR/review/merge 4) Finalize
Validation Signals: <required commands/results to confirm before PR>
Completion Steps: <merge strategy, cleanup, metrics update>
```

Do **not** translate this into placeholders; every bullet must mention actual WIs, commands, or outcomes. If a line cannot be filled with facts, pause and ask for clarification.

## Anti-placeholder Rule

- Never respond with generic placeholders such as "Change 1"/"Change 2", empty checkboxes that read as pre-checked, or unnamed sections. Every section must describe real actions, outcomes, and evidence.
- When summarizing PR changes/tests, reference actual files, commands, or results (e.g., `pnpm test packages/parser -- --runInBand`). Copying template text without filling these fields violates the rule.

## Completion Gate

- Never mark a work item `closed` or `completed` when any required checklist item is unchecked.
- If a checkbox is intentionally skipped, record the reason and explicit user approval before changing status.
- If evidence is missing for any checklist/test/dependency item, keep the work item in `in-progress` or `ready-for-review`.
- Never close a WI from a combined PR that also includes unrelated WI scope.

## Atomic Scope Gate

- Keep branch, commits, and PR scoped to one WI.
- Create one PR per WI. Do not open phase-level or multi-WI umbrella PRs for implementation work.
- Split implementation into atomic commits: each commit should represent one coherent change with matching tests/docs updates when applicable.
- If the user asks for multiple WIs, plan parallel/sequential execution as separate branches and separate PRs.
- If scope drifts beyond the active WI, stop and either: (1) create a follow-up WI, or (2) ask user approval to re-scope.

## Workspace Safety Gate

- Treat existing uncommitted changes outside the active WI as protected parallel work.
- Never discard, reset, checkout, or overwrite out-of-scope workspace changes.
- Never run destructive cleanup commands (`git reset --hard`, `git checkout --`, broad `git clean`) unless the user explicitly requests that exact action.
- If out-of-scope changes block progress, stop and ask the user how to proceed (for example: isolate on a new branch, stash with explicit approval, or sequence WI execution).
- Before commit/PR actions, verify staged files only belong to the active WI; unstage unrelated files instead of deleting changes.

## Prerequisites & Preparation

1. Ensure `auditing-backlog` has run recently and that `links.depends_on` data are up to date; rely on the dependency graph coverage described in `skills/auditing-backlog/SKILL.md`, Phases 2-4.
2. Confirm no blocking dependencies are `in-progress` or `ready` by checking their status fields; only start when blockers are `closed` or explicitly deferred.
3. Verify tooling (`pnpm`, `gh`, credentials) is configured locally; document any missing SDKs or credentials in the plan before touching code.

## Execution Phases (after plan confirmed)

### Phase 1: Planning & Validation

- Run `auditing-backlog` to surface orphans and dependency chains before work begins.
- Update the WI status to `in-progress` (`update-work-item`), list verified dependencies, and note any unresolved blockers in the work item notes.
- Record the chosen feature branch name, expected tests, and merge point inside the plan output.
- Record current workspace state (`git status --short`) and identify out-of-scope changes that must be preserved during this WI.

### Phase 2: Branching & Implementation

- Use `feature-branch-management` to create/sync a branch (`feature/wi-NNN-slug` or `bugfix/...`).
- Implement code using guidance from `modern-javascript-patterns`, `typescript-advanced-types`, and `nodejs-backend-patterns` as appropriate.
- Expand tests per `javascript-testing-patterns`; reference actual files/commands when documenting coverage.
- Commit via `git-commit` with a conventional message tied to the WI, using multiple atomic commits as work advances instead of a single end-of-phase commit.
- Stage changes with explicit file lists for the active WI; if staging reveals unrelated files, remove them from the index and leave their working-tree changes intact.

### Phase 3: PR & Review

- Push the WI branch and create exactly one WI-scoped PR with `create-pr`, populating descriptions with real work item summaries, changes, and testing commands.
- Maintain checkbox integrity: check boxes only after confirming evidence (e.g., `[x] Unit tests (`pnpm test src/feature.test.ts`)`). Leave unchecked until the command runs successfully.
- Seek reviewers via `copilot-pull-request`, `pull-request-tool`, or `gh-pr-review` and use `code-review-excellence` to surface gaps.

### Phase 4: Feedback, Merge, Finalization

- Use `handle-pr-feedback`/`resolve-pr-comments` to close blockers; categorize comments (blocker/major/minor) explicitly in responses.
- Merge with `process-pr` following the chosen strategy; document the merge command/results in the plan output.
- Finalize the work item with `finalize-work-item`, recording actual hours, metrics, and cleaning up branches per `feature-branch-management`.

## Monitoring & Metrics

- Track cycle time, review rounds, test coverage, deployment frequency, blocker rate, and rework rate. Use the simple script in the previous version as needed, but document any anomalies directly in the work item.

## Scope-adjustment Proposal

If covering the full end-to-end workflow in one skill proves too broad, split this skill: keep `executing-backlog` focused on orchestration/planning (clarification gate, plan output, dependency checks) and delegate implementation/review to targeted skills (e.g., `code-execution`, `review-management`). That separation keeps each skill concise and easier to validate.
