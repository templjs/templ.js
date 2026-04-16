---
$schema: schemas/work-management/frontmatter/record.json
id: record:066-publish-benchmark-baselines-and-pr-comparisons-in-cicd-evidence-1
title: '066: Publish Benchmark Baselines and PR Comparisons in CI/CD evidence 1'
summary: '066: Publish Benchmark Baselines and PR Comparisons in CI/CD evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.768Z

## Outcome

noted

## Observation

Added the dedicated benchmark GitHub Actions workflow and CI publication/comparison wiring.
Validation:

- Parsed `.github/workflows/benchmark.yml` successfully with the local `yaml` parser
- `pnpm benchmark:ci -- --output /tmp/templjs-benchmark-results.json --summary-output /tmp/templjs-benchmark-summary.md`
- `pnpm benchmark:compare -- --baseline /tmp/templjs-benchmark-results.json --candidate /tmp/templjs-benchmark-results.json --output /tmp/templjs-benchmark-comparison.json --markdown /tmp/templjs-benchmark-comparison.md`
  Notes:
- Workflow publishes benchmark result artifacts on PRs, `main`, nightly, and `release/**` runs.
- PR runs compare against the latest successful `main` artifact, publish job summaries, and upsert a sticky PR comment when permissions allow.
- Threshold policy remains informational until `benchmarks/policy.json` is switched to enforcement in a follow-up.

## Subject References

- [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/29>
- <https://github.com/templjs/templ.js/pull/30>
