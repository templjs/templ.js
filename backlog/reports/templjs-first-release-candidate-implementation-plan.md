---
$schema: schemas/work-management/frontmatter/plan.json
id: plan:templjs-first-release-candidate-implementation
title: templjs First Release Candidate Implementation Plan
summary: Execution plan for the full-stack templjs first release candidate.
type: plan
subtype: tactical
lifecycle: active
status: ready
status_reason: prioritized
---

## templjs Full-Stack RC Execution Plan

## Purpose

This file is the execution tracker for the full templjs first release candidate. The immediate deliverable is the tracking structure itself: new backlog work items `WI-119` through `WI-124` plus this plan. The post-execution deliverable is a full RC for all public templjs packages and the VS Code extension.

Final evidence collation, work item closure, and archive movement belong to `backlog-automation`. Execution agents must leave work items available for that workflow and report any automation blockers instead of manually closing or archiving them.

## Backlog Disposition

| Scope                                        | Work items                                                                     | Disposition                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Already completed but still active           | `WI-064`, `WI-069`                                                             | Flag for `backlog-automation` evidence normalization, closure confirmation, and archiving. Do not manually archive. |
| Required release/quality scope               | `WI-037`, `WI-041`, `WI-061`, `WI-070`, `WI-071`, `WI-072`, `WI-090`, `WI-118` | Required for RC unless a blocker is explicitly recorded.                                                            |
| Required architecture/performance/test scope | `WI-073` through `WI-087`                                                      | Required for the full-stack RC.                                                                                     |
| New RC blocker scope                         | `WI-119` through `WI-124`                                                      | Required tracking and release-readiness work.                                                                       |
| Nice-to-have scope                           | `WI-047` through `WI-052`                                                      | Execute only after required validation is green and only if release timing remains stable.                          |
| Deferred scope                               | `WI-023`, `WI-088`                                                             | Keep deferred unless execution discovers a direct RC blocker.                                                       |

## Execution Order

1. Create the immediate deliverables: `WI-119` through `WI-124` and this plan file.
2. Update root `AGENTS.md` only for PR/work-item handling so `backlog-automation` owns final evidence, closure, and archiving.
3. Fix release blockers in order: `WI-120`, `WI-119`, `WI-121`, `WI-122`, `WI-123`.
4. Finish shared schema rollout: `WI-070`, `WI-071`, `WI-072`.
5. Complete context graph, Volar, VS Code, test, and documentation scope: `WI-073` through `WI-083`, plus `WI-090`.
6. Complete parser and filter scope: `WI-061`, `WI-085`, `WI-086`, `WI-087`.
7. Complete CLI/offset quality fixes: `WI-037`, `WI-041`.
8. Run the full validation matrix and record RC evidence under `WI-124`.
9. Evaluate optional `WI-047` through `WI-052`; execute only if the required RC remains green.
10. Hand evidence normalization, closure, and archive movement to `backlog-automation`.

## Parallelization Map

After `WI-120` is complete, split work by ownership:

- Release lane: `WI-119`, `WI-121`, `WI-122`, `WI-123`.
- Shared schema lane: `WI-070`, `WI-071`, `WI-072`.
- Context graph lane: `WI-073`, `WI-074`.
- Volar/VS Code architecture lane: `WI-075`, `WI-076`, `WI-077`.
- Test/documentation lane: `WI-078` through `WI-083`, plus `WI-090`.
- Parser/filter lane: `WI-061`, `WI-085`, `WI-086`, `WI-087`.
- CLI/offset lane: `WI-037`, `WI-041`.

Avoid parallel edits to shared parser contracts, shared schema APIs, release workflows, and Changesets unless ownership boundaries are explicit.

## Validation Matrix

Run final validation on Node 24:

```bash
pnpm run ci:toolchain
pnpm run lint:frontmatter
pnpm run lint:ci
pnpm run type-check
pnpm run test
pnpm run build
pnpm run ci:docs-api
pnpm run benchmark:ci
pnpm run benchmark:summary
pnpm changeset status --verbose
pnpm exec vsce ls --no-dependencies
pnpm exec vsce package --no-dependencies --pre-release --out /private/tmp/templjs-rc-prerelease.vsix
```

Also run npm pack dry-runs for every public package. Use a temporary npm cache if the local npm cache is permission-constrained.

## Milestone Reporting Protocol

Report progress after these milestones:

1. Immediate deliverables created and `pnpm run lint:frontmatter` result recorded.
2. Release blockers fixed and narrow validation rerun.
3. Shared schema rollout complete.
4. Architecture, test, documentation, parser, and filter scope complete.
5. Full validation matrix complete.
6. Optional nice-to-have evaluation complete.
7. Backlog automation handoff prepared.

Each report must include completed work items, commands run, failing validations, files changed, and the next lane to execute.

## Agent Execution Prompt

Execute `backlog/reports/templjs-first-release-candidate-implementation-plan.md` end to end. First create the tracking work items and implementation plan file, then implement the required RC scope. Use Node 24, work from `staging` on a feature branch, preserve existing user changes, and read the closest `AGENTS.md` before editing each area. This plan grants narrow consent to update root `AGENTS.md` only for PR processing and work-item handling so `backlog-automation` owns final evidence, closure, and archiving. Do not manually close/archive work items, do not use `--no-verify`, do not manually edit package versions, and use Changesets for package/extension-facing changes. Report milestone progress after immediate deliverables, release blocker fixes, shared-schema rollout, architecture/parser scope, full validation, and optional nice-to-have evaluation. Pause only for credentials, rejected escalation, or destructive operations not covered by the plan.
