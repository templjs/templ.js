---
id: wi-046
type: work-item
subtype: task
lifecycle: inactive
title: '46: Standardize Progress Reporter Callback Newline Convention'
status: closed
status_reason: obsolete
priority: low
estimated: 1
actual: 0
assignee: ''
start_date: 2026-03-08
end_date: 2026-03-08
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

- [ ] Decide on convention: messages with newlines OR messages without newlines
- [ ] Update `createProgressReporter()` to follow chosen convention
- [ ] Document convention in `RenderCommandOptions` interface
- [ ] Update all callers to match convention
- [ ] Add test verifying newline behavior

## Acceptance Criteria

- [ ] Progress reporter callback contract clearly documented
- [ ] Implementation matches documented convention
- [ ] No double-newline issues in output
- [ ] All progress reporting tests pass

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901552553)

Location: `src/packages/cli/src/commands/render.ts` around line 231

Suggested: Emit newline-free messages, let callers control formatting.
