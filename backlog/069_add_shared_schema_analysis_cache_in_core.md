---
id: wi-069
type: work-item
subtype: task
lifecycle: draft
title: '069: Add Shared Schema Analysis Cache in Core'
status: proposed
priority: medium
estimated: 6
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

Create one shared schema-analysis cache in `@templjs/core` so schema compilation, metadata extraction, and path analysis are reused instead of rebuilt at each call site.

## Background

Current repo analysis still shows repeated `SchemaValidator` construction in Volar and CLI call paths. That makes schema-related work a clear performance and memory target once benchmarks exist.

## Tasks

- [ ] Design shared cache ownership and cache keys for schema analysis.
- [ ] Cache compiled validators, metadata, valid paths, and related analysis together.
- [ ] Keep `SchemaValidator` as the public facade where compatibility is needed.
- [ ] Add benchmark coverage for cold and warm schema-analysis paths.

## Acceptance Criteria

- [ ] Core exposes a reusable schema-analysis path backed by shared caching.
- [ ] Existing public schema validation behavior remains compatible.
- [ ] Benchmarks demonstrate cold vs warm behavior and are published through the benchmark pipeline.
