---
name: update-work-item
description: 'Update templjs backlog work items. Use when moving a work item between statuses, recording test results, adding commits, or advancing to in-progress or ready-for-review. Validates dependency readiness before in-progress transitions and requires pnpm run lint:frontmatter.'
---

# Update Work Item

Use this repo-local skill when editing an existing work item in backlog/.

## Required repo lifecycle

proposed -> ready -> in-progress -> ready-for-review -> closed

## Required checks before status changes

### Before moving to in-progress

- Read links.depends_on from the work item.
- Confirm each dependency is closed before starting work.
- Do not advance the item if a dependency is still proposed, ready, in-progress, or ready-for-review.
- Record a note or test_results entry when the transition reflects real execution start.

### Before moving to ready-for-review

- Ensure implementation work is complete for the current scope.
- Record commits relevant to the work item.
- Record validation evidence in test_results.
- Run pnpm run lint:frontmatter.

## Required metadata updates

- Keep actual updated as work progresses.
- Add commit hashes under commits.
- Add timestamped validation notes under test_results.
- Preserve status_reason only when the status requires it.

## Dependency validation guidance

If moving to in-progress, manually inspect dependent work item statuses first; do not rely on memory. The backlog rules for this repo are stricter than generic work-item flows.
