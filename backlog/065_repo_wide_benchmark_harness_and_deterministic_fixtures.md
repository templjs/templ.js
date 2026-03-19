---
id: wi-065
type: work-item
subtype: story
lifecycle: active
title: '065: Establish Repo-Wide Benchmark Harness and Deterministic Fixtures'
status: ready
status_reason: prioritized
priority: high
estimated: 8
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
---

## Goal

Add a first-class benchmark harness with stable fixtures and machine-readable output so repo-wide performance work is measured before any optimization refactor is judged successful.

## Background

The repo currently has a few timing-style tests and benchmark references in docs, but it does not have a dedicated benchmark runner, fixture catalog, or published result format. Without that foundation, performance and memory work remains anecdotal.

## Scope

- Add local benchmark commands for full runs, CI runs, comparison, and summary generation.
- Define deterministic benchmark fixtures across core, Volar, VS Code, and context-graph.
- Emit JSON benchmark results with enough metadata for CI comparison and later gating.
- Keep the initial harness non-gating.

## Tasks

- [ ] Choose and wire a benchmark runner suitable for the monorepo.
- [ ] Create benchmark fixtures for parser, renderer, query engine, schema analysis, Volar diagnostics/completions, VS Code schema loading, and context-graph queries.
- [ ] Define the benchmark JSON schema and summary format.
- [ ] Add root benchmark scripts for local, CI, compare, and summary workflows.
- [ ] Capture latency and advisory memory metrics with deterministic warmup and measurement settings.
- [ ] Document how packages add new benchmark cases.

## Acceptance Criteria

- [ ] Local commands exist for `benchmark`, `benchmark:ci`, `benchmark:compare`, and `benchmark:summary`.
- [ ] Benchmarks cover parser, renderer, query engine, schema analysis, Volar diagnostics/completions, VS Code schema loading, and context-graph queries.
- [ ] Output is machine-readable and stable enough for CI artifact publication and PR comparison.
- [ ] The harness is non-gating and can run end-to-end on current `main`.

## Implementation Notes

- Use fixed fixtures and explicit warmup/measurement counts so later comparisons stay meaningful.
- Treat memory results as advisory until enough historical baseline data exists.
