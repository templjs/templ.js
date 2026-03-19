---
id: wi-081
type: work-item
subtype: task
lifecycle: draft
title: '081: Rewrite Volar and VS Code Tests Toward Behavior-First Request/Result Coverage'
status: proposed
priority: medium
estimated: 5
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[068_remove_remaining_volar_statement_semantic_duplication]]'
    - '[[075_split_volar_context_graph_adapter_by_responsibility]]'
    - '[[076_split_volar_intellisense_and_diagnostic_providers_by_responsibility]]'
    - '[[077_split_vscode_server_into_schema_state_and_lsp_services]]'
---

## Goal

Rewrite Volar and VS Code tests to emphasize request/result behavior over internal call choreography, while keeping only the mocks needed at real process and platform boundaries.

## Background

The repo still has many mock-heavy IDE tests, especially around VS Code activation and server wiring. That makes refactors noisy and reduces confidence in actual authoring behavior.

## Tasks

- [ ] Identify the highest-value mock-heavy suites in Volar and VS Code.
- [ ] Replace internal call assertions with request/result behavior where the boundary is stable.
- [ ] Keep only necessary platform-boundary mocks.
- [ ] Preserve or improve integration coverage for authoring scenarios.

## Acceptance Criteria

- [ ] Volar and VS Code tests focus primarily on observable request/result behavior.
- [ ] Mock-heavy internal choreography assertions are reduced to true boundary cases.
- [ ] Authoring behavior remains green in targeted and integration suites.
