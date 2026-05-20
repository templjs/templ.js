---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:127-semantify-adapter-and-profile-contract-surface
title: '127: Semantify Adapter and Profile Contract Surface'
summary: Define Semantify adapter output, profile definition, projection output, and helper extension contracts.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 6
actual: 0
completed_date: '2026-05-20'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/156
  evidence:
    - '[[record-20260520-127-semantify-adapter-and-profile-contract-surface]]'
---

## Goal

Define the public Semantify contract surface for normalized adapter output, client-facing profile definitions, projection rules, graph output, and optional helper extension contracts.

## Background

The current Semantify API accepts template text and offsets and exposes context, references, and candidate planning. That is useful for the first consumer path, but it binds Semantify too tightly to editor enablement and a single template-oriented use case.

## Tasks

- [x] Add `AdapterOutput` contracts for normalized source observations with spans and adapter metadata.
- [x] Add `ProfileDefinition` contracts for semantic kinds, projection rules, helper extensions, and optional default adapter manifests.
- [x] Add projection output contracts that align with Context Graph primitives and provenance.
- [x] Define helper extension metadata for candidate providers, definition resolvers, hover renderers, and diagnostic planners without making them core projection behavior.
- [x] Preserve existing Semantify APIs behind compatibility exports or adapters during migration.
- [x] Add public API tests that import the real package exports.

## Progress Notes

- 2026-05-20: Added adapter/profile/projection model exports while preserving `resolveContext`, `resolveReferences`, and `planCandidates`.
- 2026-05-20: Added projection and TemplJS adapter tests through public package exports.
- 2026-05-20: Merged via PR #156 to `staging`; public Semantify contracts validated with compatibility exports intact.

## Deliverables

- Updated Semantify model contracts and README boundary notes.
- Public API tests for adapter/profile/projection contract exports.
- Compatibility guidance for current `resolveContext`, `resolveReferences`, and `planCandidates` consumers.

## Acceptance Criteria

- [x] Semantify exposes adapter/profile/projection contracts without external dependency leakage.
- [x] Profiles are modeled as semantic definitions plus projection rules and helper extension metadata.
- [x] Adapter implementations remain replaceable and are not intrinsic to Semantify core.
- [x] Editor affordance names do not become required core projection concepts.

## Relationships

- `depends_on`: [[work-item-125-semantify-projection-architecture-migration-epic]]
