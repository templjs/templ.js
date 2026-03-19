---
id: wi-067
type: work-item
subtype: task
lifecycle: draft
title: '067: Extract Authoritative Core Statement and Expression Analysis'
status: proposed
priority: medium
estimated: 5
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
    - '[[062_authoritative_template_parsing_and_delimiter_parity]]'
  depends_on:
    - '[[065_repo_wide_benchmark_harness_and_deterministic_fixtures]]'
    - '[[066_publish_benchmark_baselines_and_pr_comparisons_in_cicd]]'
---

## Goal

Move the remaining statement- and expression-semantic authority into `@templjs/core` so IDE consumers rely on one parser-backed source of truth instead of parallel semantic logic.

## Background

Delimiter-aware scope binding and declaration offsets are already in core, but Volar still owns expression-analysis utilities and some downstream consumers still reconstruct semantics locally.

## Tasks

- [ ] Define the remaining additive core API for parser-backed statement and expression analysis.
- [ ] Move or adapt the remaining reusable semantic logic into core.
- [ ] Keep compatibility wrappers where needed while downstream consumers migrate.
- [ ] Add benchmark cases and regression coverage for the new authority surface.

## Acceptance Criteria

- [ ] The remaining reusable statement/expression semantic facts needed by IDE consumers are available from core.
- [ ] New or migrated APIs are additive and benchmarked.
- [ ] Core tests cover the authority surface and its delimiter-aware behavior.

## Implementation Notes

- Cite before/after benchmark cases from `WI-065` and `WI-066` in the final implementation evidence.
