---
id: wi-038
type: work-item
subtype: task
lifecycle: active
title: '38: Optimize Volar Incremental Update to Avoid Full Rebuild'
status: closed
status_reason: obsolete
priority: medium
estimated: 3
actual: 3
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
      WI-038 already fixed in PR #23 commit ce96fda:
      - Simplified updateFromChange() to consistently use originalToCleanedOffsets offset table
      - Removed unused positionMappings/freshMappings intermediate variables
      - createMappings() now uses offset table directly instead of fallback character walk
      - Test coverage: src/packages/volar/test/index.test.ts (45 tests passing)
      - Change implemented in src/packages/volar/src/index.ts lines 170-220
---

## Goal

Optimize the incremental update paths in Volar virtual code to actually avoid O(n) full-document rescans when applying simple or bounded edits.

## Background

PR 23 unresolved comment: `updateFromChange()` always re-runs `stripTemplateSyntax()` over the full `this.original` and rebuilds mappings after applying an edit. The "simple edit" vs "bounded window" machinery (applyEdit/applyBoundedEdit/findEditWindow) adds significant complexity but provides no runtime benefit since every path triggers a full rebuild.

Current behavior makes docstrings claiming "reprocesses only that region" inaccurate.

## Tasks

- [x] Audit `updateFromChange()` to identify why full rebuild always occurs
- [x] Either optimize incremental paths to skip full rebuild when edit succeeds, OR
- [x] Remove/simplify bounded-edit path and update comments to reflect actual behavior
- [x] Add performance benchmarks for incremental vs full rebuild
- [x] Update docstrings to accurately reflect implementation

## Acceptance Criteria

- [x] Incremental edit paths either skip full rebuild OR code is simplified with accurate docs
- [x] Performance characteristics documented and validated with benchmarks
- [x] Existing Volar tests remain passing
- [x] No regressions in diagnostic accuracy or position mapping

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901368197)
