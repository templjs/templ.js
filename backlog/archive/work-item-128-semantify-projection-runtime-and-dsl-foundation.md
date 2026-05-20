---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:128-semantify-projection-runtime-and-dsl-foundation
title: '128: Semantify Projection Runtime and DSL Foundation'
summary: Implement the Semantify projection runtime foundation with deterministic typed rules and a path toward declarative DSL adoption.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 8
actual: 0
completed_date: '2026-05-20'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/156
  evidence:
    - '[[record-20260520-128-semantify-projection-runtime-and-dsl-foundation]]'
---

## Goal

Implement a Semantify projection runtime that validates adapter output, applies profile projection rules, and emits deterministic graph nodes/edges with provenance while leaving the target state open for a declarative DSL.

## Background

The target architecture should be declarative, but the DSL should not be frozen before real profiles prove the needed operators. A typed rule registry can establish stable IDs, versions, deterministic ordering, and provenance while a declarative subset is designed incrementally.

## Tasks

- [x] Add adapter output validation for schema version, adapter id/version, source document identity, spans, and node content.
- [x] Add a typed projection rule registry with stable rule IDs, versions, and deterministic execution order.
- [x] Emit graph nodes and edges with required provenance envelopes.
- [x] Add projection diagnostics that describe contract or mapping failures without policy severity decisions.
- [x] Add initial declarative DSL operator planning for selectors, field mapping, normalization, canonicalization, stable IDs, and synthesis.
- [x] Add determinism tests for repeated identical input/profile/rule execution.

## Progress Notes

- 2026-05-20: Added `SemantifyProjectionRuntime`, `createProjectionRuntime`, and `projectSemanticGraph`.
- 2026-05-20: Added tests for deterministic projection, typed projection rules, and invalid-span diagnostics.
- 2026-05-20: Merged via PR #156 to `staging`; projection runtime determinism and diagnostics validated in CI.

## Deliverables

- Projection runtime implementation in `@templjs/semantify`.
- Typed rule registry and deterministic projection tests.
- DSL roadmap documentation grounded in implemented rule behavior.

## Acceptance Criteria

- [x] Same adapter input plus same profile/rule versions produces byte-stable output ordering.
- [x] Every projected node/edge has provenance that traces to adapter input and projection rule id.
- [x] Projection diagnostics are structured but do not encode editor or CI policy.
- [x] The runtime can evolve toward declarative rules without changing adapter output contracts.

## Relationships

- `depends_on`: [[work-item-126-context-graph-primitive-and-provenance-contracts]]
- `depends_on`: [[work-item-127-semantify-adapter-and-profile-contract-surface]]
