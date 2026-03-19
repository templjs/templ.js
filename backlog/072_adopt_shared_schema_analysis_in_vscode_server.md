---
id: wi-072
type: work-item
subtype: task
lifecycle: draft
title: '072: Adopt Shared Schema Analysis in VS Code Server'
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

Use the shared core schema-analysis path in the VS Code server layer instead of keeping separate schema-analysis behavior in server-side flows.

## Background

The server remains a large mixed-responsibility file and still participates in schema loading and orchestration. Shared schema analysis should be reused there before deeper server decomposition.

## Tasks

- [ ] Audit server-side schema-analysis and schema-metadata call sites.
- [ ] Route reusable schema analysis through core.
- [ ] Preserve transport, configuration, and LSP payload behavior.
- [ ] Capture benchmark evidence for schema-loading and schema-backed request flows.

## Acceptance Criteria

- [ ] Server-side schema-analysis flows reuse the shared core path where appropriate.
- [ ] Existing authoring behavior stays green.
- [ ] Benchmark evidence is attached to the work item.
