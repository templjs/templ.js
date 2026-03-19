---
id: wi-075
type: work-item
subtype: task
lifecycle: draft
title: '075: Split Volar Context-Graph Adapter by Responsibility'
status: proposed
priority: medium
estimated: 4
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[065_repo_wide_benchmark_harness_and_deterministic_fixtures]]'
    - '[[066_publish_benchmark_baselines_and_pr_comparisons_in_cicd]]'
    - '[[070_adopt_shared_schema_analysis_in_volar]]'
---

## Goal

Split `context-graph-adapter.ts` into smaller responsibility-focused modules so schema lookup, scoped-path resolution, and graph orchestration are easier to optimize and test independently.

## Background

`context-graph-adapter.ts` remains one of the largest production files in the repo and still blends multiple semantic responsibilities.

## Tasks

- [ ] Identify adapter responsibilities and define smaller internal module boundaries.
- [ ] Extract the responsibilities into focused modules without changing public behavior.
- [ ] Keep graph-backed semantic reads and fallback behavior green.
- [ ] Attach benchmark deltas where the refactor changes hot paths.

## Acceptance Criteria

- [ ] Adapter responsibilities are separated into focused modules.
- [ ] Existing graph-backed authoring behavior remains green.
- [ ] The refactor is backed by before/after benchmark evidence where relevant.
