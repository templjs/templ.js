---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:134-volar-completion-hover-definition-graph-cutover
title: '134: Volar Completion, Hover, and Definition Graph Cutover'
summary: Remove legacy Semantify intent helpers from Volar and route completion, hover, and definition through projection/profile extension execution only.
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: critical
estimated: 10
actual: 0
links:
  evidence:
    - '[[record-20260521-221758-134-volar-completion-hover-definition-graph-cutover]]'
---

## Goal

Cut Volar read paths over to projected graph and profile helper extensions for completion, hover, and definition without fallback to legacy Semantify compatibility APIs.

## Background

`intellisense-provider` still consumes `createSemantifyServices` and `planCandidates` for key authoring behaviors. Final-state architecture requires graph/provenance + helper extensions as the sole semantic source.

## Scope

- Replace legacy Semantify intent-based calls in Volar.
- Route completion, hover, definition through projection/profile extension path.
- Preserve range/alias accuracy through provenance-backed mapping.

## Tasks

- [ ] Remove `createSemantifyServices` usage and direct `planCandidates` calls from Volar intellisense provider.
- [ ] Implement graph-based candidate planning via profile helper extension execution.
- [ ] Implement graph/provenance-based hover payload rendering.
- [ ] Implement graph/provenance-based definition target resolution.
- [ ] Remove compatibility fallback branches tied to legacy Semantify service semantics.
- [ ] Expand integration coverage for aliases, scoped paths, frontmatter/content zones, and filter contexts.

## Deliverables

- Projection-backed Volar intellisense path for completion/hover/definition.
- Updated tests proving parity and removal of legacy helper dependency.

## Acceptance Criteria

- [ ] No Volar source path invokes `createSemantifyServices`, `resolveContext`, `resolveReferences`, or `planCandidates`.
- [ ] Completion, hover, and definition flow through projection graph plus helper-extension contracts only.
- [ ] Integration tests verify parity and range correctness across mixed semantic zones.

## Relationships

- `depends_on`: [[work-item-133-semantify-runtime-determinism-and-provenance-strict-mode]]

## Validation

```bash
pnpm --filter @templjs/volar test
pnpm --filter @templjs/volar build
```
