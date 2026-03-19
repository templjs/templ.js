---
id: wi-078
type: work-item
subtype: task
lifecycle: draft
title: '078: Co-Locate Core and Context-Graph Module Tests with Sources'
status: proposed
priority: medium
estimated: 4
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
    - '[[063_colocate_tests_with_primary_target_modules]]'
  depends_on:
    - '[[067_extract_authoritative_core_statement_and_expression_analysis]]'
    - '[[069_add_shared_schema_analysis_cache_in_core]]'
    - '[[073_optimize_context_graph_query_indexes_and_ordering]]'
    - '[[074_reuse_query_engine_builtin_registry_and_metadata]]'
---

## Goal

Move core and context-graph module-focused tests beside their primary source modules and split centralized suites until module ownership is explicit.

## Background

Core still carries most of its unit and module coverage under package-level `test/` directories, including some of the largest suites in the repo.

## Tasks

- [ ] Inventory current core and context-graph suites by primary target module.
- [ ] Move module-focused suites beside their owning source modules.
- [ ] Split umbrella suites where one file still covers multiple primary modules.
- [ ] Preserve public API and integration coverage where centralized placement remains justified.

## Acceptance Criteria

- [ ] Core and context-graph module-focused tests are colocated with their primary modules.
- [ ] Retained centralized suites are limited to explicit integration or boundary coverage.
- [ ] Package tests still pass after the migration.
