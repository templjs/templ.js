---
id: wi-044
type: work-item
subtype: bug
lifecycle: active
title: '44: Fix Stale Offset Mappings When Simple Edit Falls Back to Bounded'
status: closed
status_reason: obsolete
priority: high
estimated: 3
actual: 0
assignee: ''
start_date: 2026-03-08
end_date: 2026-03-08
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
notes:
  - timestamp: 2026-03-08T00:00:00Z
    note: |
      WI-044 already fixed in PR #23 commit ce96fda:
      - Removed fallback character-by-character mapping logic
      - mapOriginalOffsetToCleaned() now uses originalToCleanedOffsets table exclusively
      - Simplified updateFromChange() to always use offset table
      - Test coverage: src/packages/volar/test/index.test.ts (45 tests passing)
      - Change implemented in src/packages/volar/src/index.ts lines 356+
      - Removed complex fallback logic that could leave mappings stale
---

## Goal

Ensure offset mappings and cleaned text remain consistent when `applyEdit()` falls back from simple-edit to bounded-edit path.

## Background

PR 23 unresolved comment: `updateFromChange()` only recomputes `originalToCleanedOffsets`/`mappings` when `simpleEdit` is false. But `applyEdit()` can fall back from simple-edit into `applyBoundedEdit()` (when offset mapping fails) while `simpleEdit` remains true, leaving mappings stale.

This can corrupt diagnostics and language server features after incremental edits.

## Tasks

- [ ] Track whether bounded edit was actually used in fallback scenario
- [ ] Return flag from `applyEdit()` indicating bounded reprocessing occurred
- [ ] Recompute offsets/mappings whenever bounded edit runs (including fallback)
- [ ] Add test case for simple→bounded fallback scenario
- [ ] Verify mapping correctness after fallback path

## Acceptance Criteria

- [ ] Offset mappings updated when `applyEdit()` falls back to `applyBoundedEdit()`
- [ ] Diagnostics remain accurate after fallback scenario
- [ ] New regression test for fallback path passes
- [ ] No stale mapping issues in incremental edit flows

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901552558)

Location: `src/packages/volar/src/index.ts` around line 222
