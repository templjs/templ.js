---
id: wi-083
type: work-item
subtype: task
lifecycle: draft
title: '083: Document Benchmark Workflow, Semantic Ownership, Schema Cache, and Test Conventions'
status: proposed
priority: medium
estimated: 3
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[066_publish_benchmark_baselines_and_pr_comparisons_in_cicd]]'
    - '[[067_extract_authoritative_core_statement_and_expression_analysis]]'
    - '[[069_add_shared_schema_analysis_cache_in_core]]'
    - '[[082_remove_overlapping_test_coverage_and_add_shared_semantic_schema_fixtures]]'
---

## Goal

Document the final benchmark workflow and the architectural/testing conventions introduced by the optimization program.

## Background

The benchmark workflow, parser-authority boundary, shared schema-analysis cache, and updated test conventions all need stable documentation once the implementation shape settles.

## Tasks

- [ ] Document how benchmark runs work locally and in CI/CD.
- [ ] Document semantic ownership boundaries between core, Volar, and VS Code.
- [ ] Document shared schema-analysis/cache expectations.
- [ ] Document final test-placement and behavior-first conventions.

## Acceptance Criteria

- [ ] Benchmark workflow documentation exists and matches the shipped commands/workflows.
- [ ] Semantic ownership is documented clearly enough to guide future contributors.
- [ ] Schema-cache expectations and test conventions are documented and linked from the relevant package guidance where appropriate.
