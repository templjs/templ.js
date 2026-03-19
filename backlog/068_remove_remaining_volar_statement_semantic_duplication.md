---
id: wi-068
type: work-item
subtype: task
lifecycle: draft
title: '068: Remove Remaining Volar Statement-Semantic Duplication'
status: proposed
priority: medium
estimated: 4
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
    - '[[062_authoritative_template_parsing_and_delimiter_parity]]'
  depends_on:
    - '[[065_repo_wide_benchmark_harness_and_deterministic_fixtures]]'
    - '[[066_publish_benchmark_baselines_and_pr_comparisons_in_cicd]]'
    - '[[067_extract_authoritative_core_statement_and_expression_analysis]]'
---

## Goal

Replace the remaining Volar-local statement-semantic logic with thin adapters over core authority so diagnostics, completions, hover, and definition stay aligned.

## Background

Scope resolution is already core-backed, but diagnostics, IntelliSense, and related helpers still own parts of the semantic decision path that should be centralized.

## Tasks

- [ ] Audit remaining statement-semantic logic in Volar providers and helpers.
- [ ] Replace duplicated semantic derivation with core-backed adapters.
- [ ] Remove stale local heuristics once parity is proven.
- [ ] Add targeted regression and benchmark evidence.

## Acceptance Criteria

- [ ] Volar no longer duplicates statement-semantic logic that now exists in core.
- [ ] Provider behavior remains green with benchmarked before/after comparisons.
- [ ] Drift cases remain covered by regression tests.
