---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:059-context-graph-api-boundary-and-rust-ready-contracts
title: '059: Enforce API boundary and Rust-ready contracts'
summary: Enforce API boundary and Rust-ready contracts
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 10
actual: 5
commits:
  82c8de1: 'feat(context-graph): add package and core semantic scope API'
  cb3f6a0: 'feat(context-graph): complete graph-backed semantic resolution'
  4c524c2: 'fix(context-graph): improve contract diagnostics and boundary checks'
  e0ede1a: 'test(context-graph): harden coverage gates'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/27
  evidence:
    - '[[record-059-context-graph-api-boundary-and-rust-ready-contracts-evidence-1]]'
    - '[[record-059-context-graph-api-boundary-and-rust-ready-contracts-evidence-2]]'
    - '[[record-059-context-graph-api-boundary-and-rust-ready-contracts-evidence-3]]'
    - '[[record-059-context-graph-api-boundary-and-rust-ready-contracts-evidence-4]]'
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

## Relationships

- `depends_on`: [[work-item-057-context-graph-kernel-and-api]]
