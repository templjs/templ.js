---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:073-optimize-context-graph-query-indexes-and-ordering
title: '073: Optimize Context-Graph Query Indexes and Ordering'
summary: Optimize Context-Graph Query Indexes and Ordering
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 5
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-073-optimize-context-graph-query-indexes-and-ordering]]'
---

## Goal

Replace read-time filtering and sorting in the context-graph engine with mutation-time indexing and stable ordering.

## Background

Repo analysis still shows `getNodes()` and `getEdges()` copying maps, filtering, and sorting at query time. That is a direct performance target once benchmark coverage exists.

## Tasks

- [ ] Design deterministic mutation-time indexes for nodes and edges.
- [ ] Preserve public query and snapshot ordering guarantees.
- [ ] Add or update benchmark coverage for representative graph sizes and query shapes.
- [ ] Keep API-boundary tests green throughout the refactor.

## Acceptance Criteria

- [ ] Read paths avoid full-copy filter-sort work for common query flows.
- [ ] Public ordering stays deterministic.
- [ ] Benchmark evidence demonstrates the improvement.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
