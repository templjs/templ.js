---
id: wi-079
type: work-item
subtype: task
lifecycle: draft
title: '079: Co-Locate Volar and VS Code Module Tests with Sources'
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
    - '[[068_remove_remaining_volar_statement_semantic_duplication]]'
    - '[[070_adopt_shared_schema_analysis_in_volar]]'
    - '[[075_split_volar_context_graph_adapter_by_responsibility]]'
    - '[[076_split_volar_intellisense_and_diagnostic_providers_by_responsibility]]'
    - '[[077_split_vscode_server_into_schema_state_and_lsp_services]]'
---

## Goal

Move Volar and VS Code module-focused tests beside their primary source modules and limit remaining central test directories to explicit integration cases.

## Background

Volar and VS Code still keep most module suites under centralized `test/` directories, even when a suite clearly protects one production module.

## Tasks

- [ ] Map current Volar and VS Code test files to their primary target modules.
- [ ] Co-locate module-focused suites with their source modules.
- [ ] Retain only clearly justified integration or process-boundary suites in centralized test directories.
- [ ] Preserve public behavior and test discovery during the migration.

## Acceptance Criteria

- [ ] Volar and VS Code module-focused tests are colocated with their primary modules.
- [ ] Remaining centralized suites are explicitly integration-oriented.
- [ ] Package tests still pass after the migration.
