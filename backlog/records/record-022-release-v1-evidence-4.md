---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-4
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 4'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 4'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.680Z

## Outcome

noted

## Observation

Completed Groups 1-3 critical-path execution follow-up:

- Group 1 cleanup complete: synced to `main`, removed merged local branch `chore/close-wi020-wi022-final-gaps`, removed stale worktree `prod-plan-critical-path`
- Group 2 archival prep complete: moved closed WI-020, WI-021, WI-024 into `backlog/archive/`
- Group 3 versioning workflow complete via Changesets (no manual package edits):
  - `pnpm changeset pre enter beta`
  - `pnpm changeset add --empty` (twice; fixed package set)
  - `pnpm changeset version` (twice) -> all fixed packages now at `0.1.0`
    Validation:
- `pnpm run lint:frontmatter` passed

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
