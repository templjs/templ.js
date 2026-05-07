---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:097-volar-target-architecture-migration-epic
title: '097: Implement TemplJS Volar target architecture migration epic'
summary: Execute docs/templjs-volar-target-architecture.md through staged, reviewable work items and package-boundary cutovers
type: work-item
subtype: epic
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 60
actual: 4
completed_date: '2026-05-06'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/75
  evidence:
    - '[[record-097-volar-target-architecture-migration-epic-evidence-1]]'
    - '[[record-098-language-core-contracts-and-boundary-tests-evidence-1]]'
    - '[[record-099-language-package-split-and-entrypoint-migration-evidence-1]]'
    - '[[record-100-root-and-embedded-virtual-code-model-cutover-evidence-1]]'
    - '[[record-101-host-language-service-composition-cutover-evidence-1]]'
    - '[[record-102-semantic-routing-core-context-graph-cutover-evidence-1]]'
    - '[[record-103-vscode-client-thinning-and-wrapper-removal-evidence-1]]'
    - '[[record-104-transitional-code-deletion-and-final-acceptance-evidence-1]]'
---

## Goal

Implement the target architecture defined in [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) with incremental, branch-scoped work items that preserve test confidence and produce reviewable PR slices.

## Background

Current implementation still keeps server and service composition under `vscode-templjs`, uses root-as-host virtual code in `@templjs/volar`, and retains local semantic fallbacks. The target architecture requires package split (`@templjs/language-core`, `@templjs/language-service`, `@templjs/language-server`), explicit embedded virtual documents, and context-graph-first semantic ownership.

## Tasks

- [x] Decompose target architecture into atomic migration work items.
- [x] Create dedicated implementation branches for each migration child work item.
- [x] Merge child work-item planning branches back into `feat/vscode-extension-volar-cleanup`.
- [x] Complete Stage 1 contract and boundary package work.
- [x] Complete Stage 2 package split for core/service/server layers.
- [x] Complete Stage 3 embedded virtual code migration.
- [x] Complete Stage 4 host-language service composition migration.
- [x] Complete Stage 5 core/context-graph semantic cutover.
- [x] Complete Stage 6 VS Code client thinning.
- [x] Complete Stage 7 transitional deletion and acceptance evidence.

## Deliverables

- [x] New migration child work items with explicit dependencies and acceptance criteria.
- [x] Branch-per-item planning and merge history on `feat/vscode-extension-volar-cleanup`.
- [x] Passing package and extension validation suites defined in the target architecture doc.
- [x] Volar Labs inspection evidence for virtual file and mapping correctness.

## Acceptance Criteria

- [x] All child work items for Stages 1-7 are closed with linked evidence.
- [x] `vscode-templjs` is thin and does not own semantic service composition.
- [x] `@templjs/language-core`, `@templjs/language-service`, and `@templjs/language-server` are the primary integration layers.
- [x] Completion/hover/definition/diagnostics share one semantic snapshot authority.
- [x] No new regex-driven semantic parsing is introduced in VS Code or Volar transport layers.

## Child Tasks

- [x] [[work-item-098-language-core-contracts-and-boundary-tests]]
- [x] [[work-item-099-language-package-split-and-entrypoint-migration]]
- [x] [[work-item-100-root-and-embedded-virtual-code-model-cutover]]
- [x] [[work-item-101-host-language-service-composition-cutover]]
- [x] [[work-item-102-semantic-routing-core-context-graph-cutover]]
- [x] [[work-item-103-vscode-client-thinning-and-wrapper-removal]]
- [x] [[work-item-104-transitional-code-deletion-and-final-acceptance-evidence]]

## Relationships

- `depends_on`: [[work-item-093-bug-no-host-language-service-plugins]]
- `depends_on`: [[work-item-096-bug-ci-local-build-drift-for-vscode-extension]]
- `relates_to`: [[work-item-056-context-graph-platform-epic]]
- `relates_to`: [[work-item-060-context-graph-hover-definition-exclusive-cutover]]
- `relates_to`: [[work-item-095-bug-syntax-highlighting-autocomplete-hover-not-working]]
