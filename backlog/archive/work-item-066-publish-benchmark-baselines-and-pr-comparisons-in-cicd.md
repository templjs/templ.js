---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:066-publish-benchmark-baselines-and-pr-comparisons-in-cicd
title: '066: Publish Benchmark Baselines and PR Comparisons in CI/CD'
summary: Publish Benchmark Baselines and PR Comparisons in CI/CD
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 6
actual: 6
completed_date: '2026-03-19'
commits:
  27a2f28: 'ci(benchmarks): publish benchmark workflow'
  05a1aa6: 'fix(benchmarks): harden comparison policy inputs'
  929936d: 'fix(benchmarks): close comparison threshold gaps'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/29
    - https://github.com/templjs/templ.js/pull/30
  evidence:
    - '[[record-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd-evidence-1]]'
    - '[[record-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd-evidence-2]]'
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

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
