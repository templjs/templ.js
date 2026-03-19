---
id: wi-070
type: work-item
subtype: task
lifecycle: draft
title: '070: Adopt Shared Schema Analysis in Volar'
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
    - '[[069_add_shared_schema_analysis_cache_in_core]]'
---

## Goal

Replace repeated Volar-local schema-analysis construction with the shared core schema-analysis path.

## Background

`context-graph-adapter` and `diagnostic-provider` still construct `SchemaValidator` instances directly for repeated metadata and validation work.

## Tasks

- [ ] Audit Volar schema-analysis entry points.
- [ ] Swap direct schema-validator construction for shared core analysis handles.
- [ ] Preserve current feature behavior while reducing repeated analysis cost.
- [ ] Record benchmark deltas for Volar schema-heavy scenarios.

## Acceptance Criteria

- [ ] Volar reuses shared schema analysis instead of rebuilding it opportunistically.
- [ ] Existing Volar schema-backed completions, diagnostics, and metadata behavior remain green.
- [ ] Benchmark evidence is attached to the implementation.
