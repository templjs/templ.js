---
id: wi-074
type: work-item
subtype: task
lifecycle: draft
title: '074: Reuse Query-Engine Builtin Registry and Metadata'
status: proposed
priority: medium
estimated: 3
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

Remove repeated builtin registration and metadata construction from `QueryEngine` instance setup while preserving current query behavior.

## Background

The utility signature mismatch has already been corrected on `main`, but the engine still rebuilds builtin registry and metadata state for each new instance.

## Tasks

- [ ] Extract shared immutable builtin registry and metadata defaults.
- [ ] Keep per-instance mutable variable metadata behavior intact.
- [ ] Add benchmark cases for query-engine construction and representative query execution.

## Acceptance Criteria

- [ ] Builtin registry and metadata setup is shared rather than rebuilt for every engine instance.
- [ ] Existing query behavior and metadata access remain compatible.
- [ ] Benchmark evidence is captured for initialization and steady-state behavior.
