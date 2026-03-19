---
id: wi-064
type: work-item
subtype: epic
lifecycle: active
title: '064: Benchmark-First Repo Optimization Program'
status: ready
status_reason: prioritized
priority: high
estimated: 24
actual: 0
assignee: ''
---

## Goal

Track the repo-wide optimization program with a benchmark-first rollout so performance work is measured before refactors are prioritized, implemented, or validated.

## Background

Recent repo-wide analysis shows the main codebase is functionally green, but the remaining opportunities are mostly performance, memory, architecture, and test-structure follow-ups. The program needs one backlog umbrella that enforces a clear rule:

- Benchmarking is the only initial critical path.
- Breaking API changes get their own dedicated high-priority stories only if implementation proves they are necessary.
- True functional blockers get their own concrete bug items only when they are discovered.
- All remaining work is tracked as atomic technical-debt tasks.

## Scope

- Add benchmark foundation and CI publication as the only immediate critical-path work.
- Record remaining production and test follow-ups as technical-debt tasks with explicit dependencies.
- Keep parser-authority and test-colocation follow-ups aligned with existing items `[[062_authoritative_template_parsing_and_delimiter_parity]]` and `[[063_colocate_tests_with_primary_target_modules]]`.
- Prevent generic blocker buckets or speculative API-break work items from entering the critical path.

## Tasks

- [ ] Create the benchmark harness work item and mark it ready.
- [ ] Create the benchmark publication and comparison work item and mark it ready.
- [ ] Create atomic technical-debt tasks for remaining production optimizations.
- [ ] Create atomic technical-debt tasks for remaining test-architecture and documentation work.
- [ ] Keep all non-benchmark follow-up work out of the immediate critical path until benchmark publication exists.
- [ ] Create a dedicated high-priority story only if an actual breaking API change is discovered.
- [ ] Create a dedicated bug only if a real functional blocker is discovered.

## Acceptance Criteria

- [ ] Benchmark foundation and benchmark publication items exist as `ready` critical-path work.
- [ ] Remaining repo-wide follow-up work is represented by discrete technical-debt tasks rather than broad catch-all stories.
- [ ] No generic breaking-API or blocker placeholder item is created.
- [ ] Parser-authority and test-colocation work is linked back to the existing relevant backlog items rather than duplicated.

## Child Tasks

- [ ] [[065_repo_wide_benchmark_harness_and_deterministic_fixtures]]
- [ ] [[066_publish_benchmark_baselines_and_pr_comparisons_in_cicd]]
- [ ] [[067_extract_authoritative_core_statement_and_expression_analysis]]
- [ ] [[068_remove_remaining_volar_statement_semantic_duplication]]
- [ ] [[069_add_shared_schema_analysis_cache_in_core]]
- [ ] [[070_adopt_shared_schema_analysis_in_volar]]
- [ ] [[071_adopt_shared_schema_analysis_in_cli]]
- [ ] [[072_adopt_shared_schema_analysis_in_vscode_server]]
- [ ] [[073_optimize_context_graph_query_indexes_and_ordering]]
- [ ] [[074_reuse_query_engine_builtin_registry_and_metadata]]
- [ ] [[075_split_volar_context_graph_adapter_by_responsibility]]
- [ ] [[076_split_volar_intellisense_and_diagnostic_providers_by_responsibility]]
- [ ] [[077_split_vscode_server_into_schema_state_and_lsp_services]]
- [ ] [[078_colocate_core_and_context_graph_module_tests_with_sources]]
- [ ] [[079_colocate_volar_and_vscode_module_tests_with_sources]]
- [ ] [[080_rewrite_cli_tests_toward_behavior_first_public_workflows]]
- [ ] [[081_rewrite_volar_and_vscode_tests_toward_behavior_first_request_result_coverage]]
- [ ] [[082_remove_overlapping_test_coverage_and_add_shared_semantic_schema_fixtures]]
- [ ] [[083_document_benchmark_workflow_semantic_ownership_schema_cache_and_test_conventions]]

## Implementation Notes

- Treat this epic as the sequencing authority for the optimization program, not as an implementation catch-all.
- New breaking-change or blocker items should be created only when discovered by benchmark or implementation work.
- Technical-debt tasks should remain small enough to be implemented and reviewed independently.
