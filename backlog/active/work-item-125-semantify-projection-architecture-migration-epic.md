---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:125-semantify-projection-architecture-migration-epic
title: '125: Semantify Projection Architecture Migration Epic'
summary: Migrate semantify and context-graph toward adapter/profile projection architecture for reusable semantic overlays.
type: work-item
subtype: epic
lifecycle: active
status: ready-for-review
status_reason: implementation-complete
priority: high
estimated: 32
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/156
  evidence:
    - '[[record-20260520-125-semantify-projection-architecture-migration-epic]]'
---

## Goal

Migrate `@templjs/semantify` and `@templjs/context-graph` from the current editor-oriented semantic helper shape toward a projection-first architecture with replaceable adapters, client-facing profiles, required provenance, and reusable graph primitives.

## Background

Current Semantify behavior is narrowly shaped around template text, offsets, hover/definition/candidate planning, and Volar integration. Context Graph provides generic graph facts and deterministic queries, but does not yet require provenance or distinguish graph primitives from semantic-domain interpretation. The target architecture separates:

- adapters that bridge source context implementations into normalized observations,
- profiles that define semantic definitions, projection rules, and optional helper extension contracts,
- Semantify projection that emits canonical graph output with provenance,
- Context Graph primitives and deterministic query/storage contracts,
- client/domain helpers that handle editor affordances, diagnostics policy, and resolution.

## Scope

- Define the package boundary target for Semantify, Context Graph, adapters, profiles, and profile helper extensions.
- Add projection and provenance contracts without breaking current consumers prematurely.
- Move reusable schema/template semantic projection out of Volar-specific implementation paths.
- Keep hover, definition, completion, and diagnostics policy out of Semantify core while preserving client-facing reuse through extension hooks.

## Tasks

- [x] Land Context Graph primitive and provenance contract updates.
- [x] Land Semantify adapter/profile/projection contract updates.
- [x] Introduce a typed projection runtime foundation that can evolve toward a declarative DSL.
- [x] Add TemplJS template and schema adapters/profile integration.
- [x] Cut language-service and Volar consumers over to profile helper extension boundaries.
- [x] Update package READMEs and architecture docs with the final boundaries.

## Progress Notes

- 2026-05-20: Added provenance-aware graph primitives in `@templjs/context-graph`.
- 2026-05-20: Added Semantify adapter/profile/projection contracts and deterministic projection runtime.
- 2026-05-20: Added TemplJS template/schema adapter helpers and authoring profile.
- 2026-05-20: Added a Volar projection snapshot adapter as the first language-service-facing bridge. Full removal of legacy editor-shaped helper paths remains for follow-up cutover.
- 2026-05-20: Routed Volar schema-path and enum semantic reads through Semantify projected graph output while preserving the existing compatibility query shape.
- 2026-05-20: Validation passed for `pnpm run build`, `pnpm run type-check`, and `pnpm run test` under Node 24. `pnpm run lint:frontmatter` remains blocked by archived `WI-124` depending on ready `WI-037`.
- 2026-05-20: PR #156 merged to `staging` with green CI and migration coverage updates for language-service and Volar cutover branches.

## Deliverables

- Updated `@templjs/context-graph` graph primitive and provenance contracts.
- Updated `@templjs/semantify` adapter/profile/projection contracts and runtime.
- TemplJS profile/adapters that preserve current template and schema behavior.
- Language-service/Volar integration using Semantify output and profile helper boundaries.
- Migration evidence and compatibility tests for existing authoring behavior.

## Acceptance Criteria

- [x] Semantify can consume normalized adapter output and emit deterministic graph nodes/edges with provenance.
- [x] Context Graph remains domain-agnostic and does not interpret template, schema, editor, or link semantics.
- [x] Profiles are client-facing semantic definitions with projection rules and optional helper extensions.
- [x] Editor-specific affordances are outside Semantify core contracts.
- [x] Current TemplJS authoring behavior remains covered by integration tests.

## Relationships

- `includes`: [[work-item-126-context-graph-primitive-and-provenance-contracts]]
- `includes`: [[work-item-127-semantify-adapter-and-profile-contract-surface]]
- `includes`: [[work-item-128-semantify-projection-runtime-and-dsl-foundation]]
- `includes`: [[work-item-129-templjs-template-and-schema-profile-integration]]
- `includes`: [[work-item-130-language-service-helper-extension-cutover]]
