---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:126-context-graph-primitive-and-provenance-contracts
title: '126: Context Graph Primitive and Provenance Contracts'
summary: Add domain-agnostic graph primitives and required provenance support to @templjs/context-graph.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation
priority: high
estimated: 5
actual: 0
links:
  evidence:
    - '[[record-20260520-126-context-graph-primitive-and-provenance-contracts]]'
---

## Goal

Update `@templjs/context-graph` so it can own reusable graph primitives and provenance contracts without becoming a semantic interpreter or graph database.

## Background

The current package exposes `ContextNode`, `ContextEdge`, snapshots, queries, and provider lifecycle hooks. It remains dependency-safe and deterministic, but provenance is only possible as an optional `attributes` convention, and provider ownership is internal rather than explicit in public fact lineage.

## Tasks

- [x] Define graph primitive contract direction for node, edge, snapshot, delta, and provenance payloads.
- [x] Add first-class provenance fields or a compatibility-safe provenance envelope for projected graph facts.
- [x] Preserve JSON-compatible, dependency-leak-safe public signatures.
- [x] Keep query/index behavior deterministic and in-process only.
- [x] Document that Context Graph does not interpret template, schema, editor, or link semantics.
- [x] Add contract tests for provenance serialization, deterministic ordering, and provider lineage.

## Progress Notes

- 2026-05-20: Added `GraphProvenance`, `SourceSpan`, `SourceLocation`, `GraphNode`, and `GraphEdge` public types.
- 2026-05-20: Added provenance serialization and mutation-isolation tests.

## Deliverables

- Updated context-graph public contracts and README boundary notes.
- Provenance-aware contract tests.
- Compatibility notes for existing `ContextNode`/`ContextEdge` consumers.

## Acceptance Criteria

- [ ] Projected graph facts can carry required source/projection provenance.
- [ ] Public graph contracts remain package-owned and JSON-compatible.
- [ ] Existing Context Graph tests remain green or have intentional migration coverage.
- [ ] No domain-specific semantic rules are added to Context Graph.

## Relationships

- `depends_on`: [[work-item-125-semantify-projection-architecture-migration-epic]]
