---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:121-publish-all-public-templjs-packages-in-release-lanes
title: '121: Publish All Public templjs Packages in Release Lanes'
summary: Update release automation so all public templjs workspace packages are versioned and published consistently.
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: awaiting-review
priority: critical
estimated: 6
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/152
  evidence:
    - '[[record-20260516-121-publish-all-public-templjs-packages-in-release-lanes]]'
---

## Goal

Ensure prerelease and stable release lanes include every public `@templjs/*` workspace package that should ship in the full-stack RC.

## Background

The fixed train covers `@templjs/core`, `@templjs/cli`, `@templjs/volar`, and `@templjs/context-graph`, but public workspace packages also include language packages and `@templjs/semantify`. Current release scripts and workflows only publish or version a subset, which can produce an incomplete RC.

## Tasks

- [x] Inventory all non-private public `@templjs/*` packages from the workspace.
- [x] Preserve fixed-version synchronization for `core`, `cli`, `volar`, and `context-graph`.
- [x] Update release scripts/workflows to version and publish all public packages in the appropriate release lane.
- [x] Include language packages and `@templjs/semantify` in prerelease/stable package dry-run validation.
- [x] Add targeted script tests or dry-run checks for the release inventory behavior.

## Deliverables

- Updated release package inventory logic.
- Updated publish workflow behavior.
- Validation evidence showing all public packages are included.

## Acceptance Criteria

- [x] Release inventory enumerates all non-private `@templjs/*` workspace packages.
- [x] Fixed train packages remain synchronized.
- [x] Public dependent packages are not silently omitted from package publishing.
- [x] `@templjs/semantify` is included unless intentionally made private by a separate decision.

## Relationships

- `part_of`: [[work-item-124-first-release-candidate-execution-and-evidence]]
- `depends_on`: [[work-item-120-normalize-vscode-extension-package-identity-and-changesets]]
- `related`: [[work-item-118-align-reusable-version-workflow-with-official-changesets-flow]]
