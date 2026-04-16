---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:038-volar-incremental-update-efficiency
title: '38: Optimize Volar Incremental Update to Avoid Full Rebuild'
summary: Optimize Volar Incremental Update to Avoid Full Rebuild
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 3
actual: 0
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-038-volar-incremental-update-efficiency-evidence-1]]'
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

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
