---
id: wi-059
type: work-item
subtype: task
lifecycle: active
title: '059: Enforce API boundary and Rust-ready contracts'
status: ready-for-review
priority: high
estimated: 10
actual: 3
assignee: ''
commits:
  82c8de1: 'feat(context-graph): add package and core semantic scope API'
test_results:
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      WI-059 implementation verification:
      - Added structured runtime error contract (`ContextGraphError` + `GraphOperationError`)
      - Added query contract compatibility and version checks for `v1`
      - Added API boundary test validating generated public `.d.ts` has no external dependency imports
      - Added serialization round-trip tests for query and error payloads
      - Added deterministic ordering assertions across `getNodes`, `getEdges`, and `query`
      - Targeted tests: 10 passed, 0 failed
      - Package build: `pnpm --filter @templjs/context-graph build` passed
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Architecture boundary correction follow-up:
      - Removed semantic/location-specific helper exports and contracts from `@templjs/context-graph`
      - Confirmed package API remains generic context publication/querying only
      - API boundary and package tests revalidated after correction
links:
  implements:
    - '[[056_context_graph_platform_epic]]'
  depends_on:
    - '[[057_context_graph_kernel_and_api]]'
---

## Goal

Guarantee that `@templjs/context-graph` public APIs remain implementation-agnostic, dependency-leak-free, and ready for future Rust engine replacement.

## PR Handoff Notes

- No active PR currently tracks this work item.
- Include commit `82c8de1` (and backlog traceability commit `b49ae91`) in the next PR.

## Tasks

- [x] Add API boundary tests verifying no external dependency symbols in public `.d.ts`
- [x] Add contract version field to externally observable payloads
- [x] Add query request/response compatibility tests for contract version `v1`
- [x] Add structured error code contract and tests
- [x] Add serialization compatibility tests for public payload types
- [x] Add deterministic output ordering checks for all public query APIs

## Acceptance Criteria

- [x] Public API passes dependency-leak checks
- [x] Contracts are versioned and serialization-safe
- [x] Query contract compatibility tests pass for `v1`
- [x] Error payloads are structured and stable
- [x] Rust-ready checklist items are demonstrably covered by tests
