---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:122-document-semantify-release-model
title: '122: Document semantify Release Model'
summary: Document how @templjs/semantify participates in package versioning and release automation.
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 3
actual: 0
links:
  evidence:
    - '[[record-20260516-122-document-semantify-release-model]]'
---

## Goal

Update release and workspace guidance so `@templjs/semantify` has an explicit package/versioning model before the full-stack RC.

## Background

The repository now contains `@templjs/semantify` as a public package, but existing guidance describes seven npm packages plus the VS Code extension. Release automation and maintainer docs need to make its status explicit.

## Tasks

- [x] Update release documentation to classify `@templjs/semantify`.
- [x] Update package/versioning guidance to distinguish fixed-train packages from public dependent packages.
- [x] Update root `AGENTS.md` version-management guidance only as narrowly needed by the RC plan consent.
- [x] Cross-reference the release inventory work item.

## Deliverables

- Documentation updates covering `@templjs/semantify`.
- Root agent guidance update if needed for accurate package-count and PR handling instructions.
- Validation evidence from docs/build checks where applicable.

## Acceptance Criteria

- [x] Release docs state whether `@templjs/semantify` is public and how it is published.
- [x] Root package guidance no longer understates the public package inventory.
- [x] The fixed synchronized train remains limited to the documented fixed packages.
- [x] No package version is manually edited.

## Relationships

- `part_of`: [[work-item-124-first-release-candidate-execution-and-evidence]]
- `depends_on`: [[work-item-121-publish-all-public-templjs-packages-in-release-lanes]]
