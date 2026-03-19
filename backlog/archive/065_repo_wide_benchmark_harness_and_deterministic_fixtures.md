---
id: wi-065
type: work-item
subtype: story
lifecycle: active
title: '065: Establish Repo-Wide Benchmark Harness and Deterministic Fixtures'
status: closed
status_reason: completed
priority: high
estimated: 8
actual: 8
assignee: ''
completed_date: '2026-03-19'
commits:
  3a59ae9: 'feat(benchmarks): add deterministic repo benchmark harness'
  3ba9ac7: 'style(benchmarks): format benchmark helper files'
  936dffa: 'fix(vscode): export explicit schema-loading default module'
  0a242cf: 'test(vscode): restore schema-loading coverage'
  18a1112: 'fix(vscode): normalize schema pattern paths'
test_results:
  - timestamp: 2026-03-19T00:00:00Z
    note: |
      Implemented the first repo-wide benchmark harness with deterministic fixtures and JSON/markdown output.
      Validation:
      - `pnpm --filter @templjs/core test -- test/semantic/semantic-context.test.ts` (13 passed)
      - `pnpm --filter vscode-templjs test -- test/server.test.ts` (32 passed)
      - `pnpm benchmark:ci -- --output /tmp/templjs-benchmark-results.json --summary-output /tmp/templjs-benchmark-summary.md`
      - `pnpm benchmark:summary -- --input /tmp/templjs-benchmark-results.json --output /tmp/templjs-benchmark-summary-regenerated.md`
      - `pnpm benchmark:compare -- --baseline /tmp/templjs-benchmark-results.json --candidate /tmp/templjs-benchmark-results.json --output /tmp/templjs-benchmark-comparison.json --markdown /tmp/templjs-benchmark-comparison.md`
      Notes:
      - Added deterministic core, Volar, VS Code, and context-graph fixtures plus machine-readable result/comparison schemas.
      - Fixed frontmatter schema alias parsing so `#/$defs/...` fragments survive document-scoped schema resolution in benchmark fixtures.
  - timestamp: 2026-03-19T19:54:04Z
    note: |
      Finalized after PR #29 merged to `main` as commit `55b8cbdc6596210b25f4b2fba3b307c3ccfbf704`.
      GitHub validation on the merged PR head passed for Benchmark, CI, CodeQL, CodeRabbit, and Codecov.
notes:
  - timestamp: 2026-03-19T19:54:04Z
    note: |
      Archived after merge. No finer-grained effort log was recorded during implementation, so `actual`
      was normalized to the tracked estimate during close-out.
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/29
    - https://github.com/templjs/templ.js/pull/30
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
