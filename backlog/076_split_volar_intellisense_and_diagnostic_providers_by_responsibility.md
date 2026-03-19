---
id: wi-076
type: work-item
subtype: task
lifecycle: draft
title: '076: Split Volar IntelliSense and Diagnostic Providers by Responsibility'
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
    - '[[068_remove_remaining_volar_statement_semantic_duplication]]'
    - '[[070_adopt_shared_schema_analysis_in_volar]]'
---

## Goal

Split the large Volar provider modules so targeting, semantic analysis, result assembly, and remapping logic are easier to optimize, benchmark, and test.

## Background

`intellisense-provider.ts` and `diagnostic-provider.ts` still carry several distinct responsibilities, making them hard to reason about and expensive to evolve.

## Tasks

- [ ] Define smaller internal provider boundaries.
- [ ] Extract focused modules for analysis, targeting, assembly, and remapping responsibilities.
- [ ] Preserve request behavior, result shapes, and current diagnostics/completion output.
- [ ] Add or update benchmark and regression evidence.

## Acceptance Criteria

- [ ] Provider responsibilities are split into smaller modules.
- [ ] Existing completion and diagnostic behavior remains green.
- [ ] Benchmark evidence is attached where hot paths change.
