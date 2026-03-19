---
id: wi-066
type: work-item
subtype: story
lifecycle: active
title: '066: Publish Benchmark Baselines and PR Comparisons in CI/CD'
status: closed
status_reason: completed
priority: high
estimated: 6
actual: 6
assignee: ''
completed_date: '2026-03-19'
commits:
  27a2f28: 'ci(benchmarks): publish benchmark workflow'
  05a1aa6: 'fix(benchmarks): harden comparison policy inputs'
  929936d: 'fix(benchmarks): close comparison threshold gaps'
test_results:
  - timestamp: 2026-03-19T00:00:00Z
    note: |
      Added the dedicated benchmark GitHub Actions workflow and CI publication/comparison wiring.
      Validation:
      - Parsed `.github/workflows/benchmark.yml` successfully with the local `yaml` parser
      - `pnpm benchmark:ci -- --output /tmp/templjs-benchmark-results.json --summary-output /tmp/templjs-benchmark-summary.md`
      - `pnpm benchmark:compare -- --baseline /tmp/templjs-benchmark-results.json --candidate /tmp/templjs-benchmark-results.json --output /tmp/templjs-benchmark-comparison.json --markdown /tmp/templjs-benchmark-comparison.md`
      Notes:
      - Workflow publishes benchmark result artifacts on PRs, `main`, nightly, and `release/**` runs.
      - PR runs compare against the latest successful `main` artifact, publish job summaries, and upsert a sticky PR comment when permissions allow.
      - Threshold policy remains informational until `benchmarks/policy.json` is switched to enforcement in a follow-up.
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
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[065_repo_wide_benchmark_harness_and_deterministic_fixtures]]'
---

## Goal

Publish benchmark baselines and candidate comparisons in CI/CD so performance evidence is visible on pull requests, on `main`, and in future release workflows.

## Background

Benchmarking only becomes useful as a program gate when candidate runs can be compared against a known baseline. The repo currently has no benchmark workflow, artifact publication, or PR summary integration.

## Scope

- Add benchmark workflow execution to pull requests, pushes to `main`, scheduled runs, and release-related workflows.
- Publish raw JSON artifacts and human-readable summaries.
- Compare PR runs against the latest successful `main` baseline while remaining non-gating initially.
- Prepare the workflow so threshold-based blocking can be enabled later without redesign.

## Tasks

- [x] Add a benchmark workflow to CI/CD.
- [x] Publish benchmark artifacts for PR, `main`, nightly, and release runs.
- [x] Compare PR benchmark runs to the latest successful `main` baseline.
- [x] Add PR/job summaries that highlight regressions and improvements.
- [x] Store threshold policy in repo configuration without failing builds initially.
- [x] Document the path to future blocking-on-regression behavior.

## Acceptance Criteria

- [x] Benchmark results are published as CI artifacts.
- [x] Pull requests receive a benchmark comparison summary against `main`.
- [x] `main` and scheduled runs publish baseline artifacts suitable for later reuse.
- [x] The workflow remains informational only until an explicit follow-up enables gating.

## Implementation Notes

- Keep baseline comparison deterministic by using one fixed CI environment for published results.
- Release publication should include benchmark summaries or artifacts so shipped versions have a recorded baseline.
