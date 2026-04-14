---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:046-cli-progress-reporter-newline-convention
title: '46: Standardize Progress Reporter Callback Newline Convention'
summary: Standardize Progress Reporter Callback Newline Convention
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: low
estimated: 1
actual: 1
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-046-cli-progress-reporter-newline-convention-evidence-1]]'
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

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
