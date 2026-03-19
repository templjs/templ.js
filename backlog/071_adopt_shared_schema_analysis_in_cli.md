---
id: wi-071
type: work-item
subtype: task
lifecycle: draft
title: '071: Adopt Shared Schema Analysis in CLI'
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
    - '[[069_add_shared_schema_analysis_cache_in_core]]'
---

## Goal

Move CLI schema validation and metadata reads onto the shared core schema-analysis path.

## Background

The CLI still constructs `SchemaValidator` directly in its validation command, making it one of the remaining direct adopters that should align with the shared cache.

## Tasks

- [ ] Migrate CLI schema-validation call sites to the shared analysis path.
- [ ] Preserve existing CLI output and error behavior.
- [ ] Attach benchmark evidence for CLI schema-backed flows.

## Acceptance Criteria

- [ ] CLI no longer bypasses the shared core schema-analysis path.
- [ ] Current CLI schema behavior remains compatible.
- [ ] Benchmark evidence is captured for the migration.
