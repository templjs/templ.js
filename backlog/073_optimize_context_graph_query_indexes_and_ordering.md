---
id: wi-073
type: work-item
subtype: task
lifecycle: draft
title: '073: Optimize Context-Graph Query Indexes and Ordering'
status: proposed
priority: medium
estimated: 5
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[065_repo_wide_benchmark_harness_and_deterministic_fixtures]]'
    - '[[066_publish_benchmark_baselines_and_pr_comparisons_in_cicd]]'
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
