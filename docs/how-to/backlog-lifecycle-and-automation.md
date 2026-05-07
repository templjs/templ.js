---
id: how-to-backlog-lifecycle-and-automation
type: document
subtype: how-to
lifecycle: active
status: ready
title: Backlog Lifecycle And Automation
description: Defines human-owned work item lifecycle steps and automation-owned close/archive behavior.
---

## Workflow

Use this sequence for normal work item execution:

1. Mark `## Tasks` checklist items as implementation work is completed.
2. Verify and mark `## Acceptance Criteria` based on concrete evidence.
3. Create and link the draft PR in `links.pull_requests`.
4. Transition the work item to `ready-for-review`.
5. Keep work-item edits on the same feature branch as implementation changes.
6. Run `/process-pr`.
7. After merge, prune local stale branches with `rtk scripts/git/cleanup-stale-local-branches.sh --apply`.

## Automation Ownership

When `.doc-vader/backlog-consumer.json` has `automation.autoCloseOnMerge: true`:

- Backlog automation creates/links merge and workflow evidence.
- Backlog automation performs close/archive transitions after merge validation.
- Contributors should not manually close/archive work items during normal feature execution.
- Automatic sweep now runs on merged pull-request `closed` events (in addition to manual `workflow_dispatch`).
- A scheduled sweep runs daily to reconcile missed transitions (`cron: 17 9 * * *`).

## Post-Merge Hygiene

Run this after each merged PR to reduce local branch drift:

```bash
# Dry-run: review the candidate branches first
rtk scripts/git/cleanup-stale-local-branches.sh

# Apply only after confirming the listed candidates are safe to delete
rtk scripts/git/cleanup-stale-local-branches.sh --apply
```

The script keeps your current branch plus `main` and `staging`, and only targets branches that are either fully merged into the base branch or functionally equivalent to it.

## Exception Path

Manual finalization is reserved for explicit reconciliation or repair cases where automation did not perform expected transitions.

## Skill Naming Migration

- Use global workflow skills: `/updating-work-item`, `/finalizing-work-item`, `/process-pr`, `/handle-pr-feedback`.
- Repository-local `update-work-item` and `finalize-work-item` skill files were removed to avoid drift from global definitions.
- Keep repository-specific lifecycle policy in [backlog/AGENTS.md](../../backlog/AGENTS.md) and enforce it via `pnpm run lint:frontmatter`.
