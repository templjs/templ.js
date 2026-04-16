---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:065-repo-wide-benchmark-harness-and-deterministic-fixtures
title: '065: Establish Repo-Wide Benchmark Harness and Deterministic Fixtures'
summary: Establish Repo-Wide Benchmark Harness and Deterministic Fixtures
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 8
actual: 8
completed_date: '2026-03-19'
commits:
  3a59ae9: 'feat(benchmarks): add deterministic repo benchmark harness'
  3ba9ac7: 'style(benchmarks): format benchmark helper files'
  936dffa: 'fix(vscode): export explicit schema-loading default module'
  0a242cf: 'test(vscode): restore schema-loading coverage'
  18a1112: 'fix(vscode): normalize schema pattern paths'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/29
    - https://github.com/templjs/templ.js/pull/30
  evidence:
    - '[[record-065-repo-wide-benchmark-harness-and-deterministic-fixtures-evidence-1]]'
    - '[[record-065-repo-wide-benchmark-harness-and-deterministic-fixtures-evidence-2]]'
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

- [x] Choose and wire a benchmark runner suitable for the monorepo.
- [x] Create benchmark fixtures for parser, renderer, query engine, schema analysis, Volar diagnostics/completions, VS Code schema loading, and context-graph queries.
- [x] Define the benchmark JSON schema and summary format.
- [x] Add root benchmark scripts for local, CI, compare, and summary workflows.
- [x] Capture latency and advisory memory metrics with deterministic warmup and measurement settings.
- [x] Document how packages add new benchmark cases.

## Acceptance Criteria

- [x] Local commands exist for `benchmark`, `benchmark:ci`, `benchmark:compare`, and `benchmark:summary`.
- [x] Benchmarks cover parser, renderer, query engine, schema analysis, Volar diagnostics/completions, VS Code schema loading, and context-graph queries.
- [x] Output is machine-readable and stable enough for CI artifact publication and PR comparison.
- [x] The harness is non-gating and can run end-to-end on current `main`.

## Implementation Notes

- Use fixed fixtures and explicit warmup/measurement counts so later comparisons stay meaningful.
- Treat memory results as advisory until enough historical baseline data exists.
