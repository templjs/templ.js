---
id: wi-077
type: work-item
subtype: task
lifecycle: draft
title: '077: Split VS Code Server into Schema, State, and LSP Services'
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
    - '[[072_adopt_shared_schema_analysis_in_vscode_server]]'
---

## Goal

Refactor the VS Code server so LSP bootstrap, schema resolution, document state, and supporting services are separated into smaller internal modules.

## Background

`server.ts` remains a large orchestration file with several responsibilities that should become explicit service boundaries before deeper optimization and test cleanup.

## Tasks

- [ ] Define internal service boundaries for bootstrap, schema resolution, and document state.
- [ ] Extract the services while preserving current LSP behavior.
- [ ] Keep integration coverage green during the refactor.
- [ ] Attach benchmark evidence for relevant request and schema-loading paths.

## Acceptance Criteria

- [ ] The server is decomposed into smaller internal services.
- [ ] Current VS Code authoring behavior remains green.
- [ ] Benchmark evidence is captured where the refactor touches hot paths.
