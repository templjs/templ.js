---
id: wi-066
type: work-item
subtype: story
lifecycle: active
title: '066: Publish Benchmark Baselines and PR Comparisons in CI/CD'
status: ready
status_reason: prioritized
priority: high
estimated: 6
actual: 0
assignee: ''
links:
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

- [ ] Add a benchmark workflow to CI/CD.
- [ ] Publish benchmark artifacts for PR, `main`, nightly, and release runs.
- [ ] Compare PR benchmark runs to the latest successful `main` baseline.
- [ ] Add PR/job summaries that highlight regressions and improvements.
- [ ] Store threshold policy in repo configuration without failing builds initially.
- [ ] Document the path to future blocking-on-regression behavior.

## Acceptance Criteria

- [ ] Benchmark results are published as CI artifacts.
- [ ] Pull requests receive a benchmark comparison summary against `main`.
- [ ] `main` and scheduled runs publish baseline artifacts suitable for later reuse.
- [ ] The workflow remains informational only until an explicit follow-up enables gating.

## Implementation Notes

- Keep baseline comparison deterministic by using one fixed CI environment for published results.
- Release publication should include benchmark summaries or artifacts so shipped versions have a recorded baseline.
