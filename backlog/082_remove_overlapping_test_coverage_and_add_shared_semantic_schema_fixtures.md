---
id: wi-082
type: work-item
subtype: task
lifecycle: draft
title: '082: Remove Overlapping Test Coverage and Add Shared Semantic/Schema Fixtures'
status: proposed
priority: medium
estimated: 3
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[078_colocate_core_and_context_graph_module_tests_with_sources]]'
    - '[[079_colocate_volar_and_vscode_module_tests_with_sources]]'
    - '[[080_rewrite_cli_tests_toward_behavior_first_public_workflows]]'
    - '[[081_rewrite_volar_and_vscode_tests_toward_behavior_first_request_result_coverage]]'
---

## Goal

Reduce duplicate test coverage and replace copy-pasted scenario setup with shared semantic and schema fixture matrices.

## Background

Once test placement and behavior shape are improved, the next cleanup step is removing duplicate scenario proof and standardizing reusable fixture inputs across layers.

## Tasks

- [ ] Inventory repeated semantic and schema scenarios across packages.
- [ ] Create shared fixture inputs for the repeated cases.
- [ ] Remove overlapping tests once canonical coverage is in place.
- [ ] Keep one clear regression per bug class or behavior class.

## Acceptance Criteria

- [ ] Repeated semantic and schema scenarios use shared fixtures where practical.
- [ ] Duplicate behavior coverage is removed without losing regression protection.
- [ ] Test suites remain green after consolidation.
