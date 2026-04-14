---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:044-volar-offset-mapping-fallback-staleness
title: '44: Fix Stale Offset Mappings When Simple Edit Falls Back to Bounded'
summary: Fix Stale Offset Mappings When Simple Edit Falls Back to Bounded
type: work-item
subtype: bug
lifecycle: inactive
status: closed
status_reason: obsolete
priority: high
estimated: 3
actual: 0
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-044-volar-offset-mapping-fallback-staleness-evidence-1]]'
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

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
