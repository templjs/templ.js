---
id: wi-046
type: work-item
subtype: task
lifecycle: inactive
title: '46: Standardize Progress Reporter Callback Newline Convention'
status: closed
status_reason: completed
priority: low
estimated: 1
actual: 1
assignee: ''
start_date: 2026-03-08
end_date: 2026-03-08
completed_date: 2026-03-08
test_results:
  - timestamp: 2026-03-08T00:00:00Z
    note: |
      Progress reporter callback convention implemented in PR #23 commits
      ce96fda and 8900fcc. Tests verify progressReporter callback receives
      messages correctly in src/packages/cli/test/commands/render.test.ts.
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
notes:
  - timestamp: 2026-03-08T00:00:00Z
    note: |
      WI-046 already fixed in PR #23 commits ce96fda and 8900fcc:
      - Refactored to progressReporter callback interface in RenderCommandOptions
      - createProgressReporter() moved to private method in DataReader class
      - CLI wires progressReporter conditionally based on --quiet and --json flags
      - Test coverage: src/packages/cli/test/commands/render.test.ts
      - Tests verify progressReporter callback receives messages correctly
      - Change implemented in src/packages/cli/src/commands/render.ts lines 224-234
      - CLI integration in src/packages/cli/src/cli.ts lines 194-195
---

## Goal

Define and document a clear convention for whether progress reporter callbacks receive messages with or without trailing newlines.

## Background

PR 23 unresolved comment: `createProgressReporter()` sends progress messages with trailing newline (`"...(${progress}%)\\n"`), but `progressReporter` is treated as a generic logger hook. This makes it easy to accidentally double-newline and complicates reuse.

## Tasks

- [x] Decide on convention: messages with newlines OR messages without newlines
- [x] Update `createProgressReporter()` to follow chosen convention
- [x] Document convention in `RenderCommandOptions` interface
- [x] Update all callers to match convention
- [x] Add test verifying newline behavior

## Acceptance Criteria

- [x] Progress reporter callback contract clearly documented
- [x] Implementation matches documented convention
- [x] No double-newline issues in output
- [x] All progress reporting tests pass

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901552553)

Location: `src/packages/cli/src/commands/render.ts` around line 231

Suggested: Emit newline-free messages, let callers control formatting.
