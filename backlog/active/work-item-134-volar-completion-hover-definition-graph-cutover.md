---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:134-volar-completion-hover-definition-graph-cutover
title: '134: Volar Completion, Hover, and Definition Graph Cutover'
summary: Remove legacy Semantify intent helpers from Volar and route completion, hover, and definition through projection/profile extension execution only.
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implementation-merged-awaiting-automation-finalization
priority: critical
estimated: 10
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/167
    - https://github.com/templjs/templ.js/pull/169
  evidence:
    - '[[record-20260521-221758-134-volar-completion-hover-definition-graph-cutover]]'
---

## Goal

Cut Volar read paths over to projected graph and profile helper extensions for completion, hover, and definition without fallback to legacy Semantify compatibility APIs.

## Background

`intellisense-provider` now routes completion, hover, and definition through projection/context-graph read adapters without legacy Semantify intent helper calls. Remaining work-item updates track verification and workflow finalization.

## Scope

- Replace legacy Semantify intent-based calls in Volar.
- Route completion, hover, definition through projection/profile extension path.
- Preserve range/alias accuracy through provenance-backed mapping.

## Tasks

- [x] Remove `createSemantifyServices` usage and direct `planCandidates` calls from Volar intellisense provider.
- [x] Implement graph-based candidate planning via profile helper extension execution.
- [x] Implement graph/provenance-based hover payload rendering.
- [x] Implement graph/provenance-based definition target resolution.
- [x] Remove compatibility fallback branches tied to legacy Semantify service semantics.
- [x] Expand integration coverage for aliases, scoped paths, frontmatter/content zones, and filter contexts.

## Deliverables

- Projection-backed Volar intellisense path for completion/hover/definition.
- Updated tests proving parity and removal of legacy helper dependency.

## Acceptance Criteria

- [x] No Volar source path invokes `createSemantifyServices`, `resolveContext`, `resolveReferences`, or `planCandidates`.
- [x] Completion, hover, and definition flow through projection graph plus helper-extension contracts only.
- [x] Integration tests verify parity and range correctness across mixed semantic zones.

## Relationships

- `depends_on`: [[work-item-133-semantify-runtime-determinism-and-provenance-strict-mode]]

## Validation

```bash
pnpm --filter @templjs/volar test
pnpm --filter @templjs/volar build
```
