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

## Automation Ownership

When `.doc-vader/backlog-consumer.json` has `automation.autoCloseOnMerge: true`:

- Backlog automation creates/links merge and workflow evidence.
- Backlog automation performs close/archive transitions after merge validation.
- Contributors should not manually close/archive work items during normal feature execution.

## Exception Path

Manual finalization is reserved for explicit reconciliation or repair cases where automation did not perform expected transitions.

## Skill Naming Migration

- Use global workflow skills: `/updating-work-item`, `/finalizing-work-item`, `/process-pr`, `/handle-pr-feedback`.
- Repository-local `update-work-item` and `finalize-work-item` skill files were removed to avoid drift from global definitions.
- Keep repository-specific lifecycle policy in [backlog/AGENTS.md](../../backlog/AGENTS.md) and enforce it via `pnpm run lint:frontmatter`.
