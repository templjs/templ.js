# Benchmark Harness

This directory contains the first repo-wide benchmark harness for `templjs`.

## Commands

- `pnpm benchmark`
  Runs the full local benchmark suite and writes JSON output.
- `pnpm benchmark:ci`
  Runs the shorter CI-oriented benchmark suite and writes JSON output.
- `pnpm benchmark:summary -- --input <results.json> --output <summary.md>`
  Renders a markdown summary from benchmark results.
- `pnpm benchmark:compare -- --baseline <baseline.json> --candidate <candidate.json> --output <comparison.json> --markdown <comparison.md>`
  Compares two benchmark runs using the policy in [`policy.json`](./policy.json).

## Output Contract

- Result JSON schema: [`../schemas/benchmark-results.schema.json`](../schemas/benchmark-results.schema.json)
- Comparison JSON schema: [`../schemas/benchmark-comparison.schema.json`](../schemas/benchmark-comparison.schema.json)
- Threshold policy: [`policy.json`](./policy.json)

Latency is the primary signal. Memory is recorded as advisory-only deltas and is intentionally non-gating for now.

## Adding New Cases

1. Add or extend deterministic fixtures in [`fixtures.ts`](./fixtures.ts) or under [`fixtures/`](./fixtures/).
2. Register a new benchmark case in [`run.ts`](./run.ts) with:
   - a stable `id`
   - a clear `group`
   - a `setup()` function that creates deterministic state
   - a `run()` function that performs one representative operation
3. Keep benchmark cases non-random and side-effect free across iterations.
4. If the new case changes the JSON contract, update the schemas in `schemas/` first.
5. Re-run `pnpm benchmark:ci` and `pnpm benchmark:summary`.

## CI Notes

The GitHub Actions workflow publishes:

- raw benchmark JSON
- markdown summaries
- PR comparisons against the latest successful `main` baseline when available

The current policy is informational only. To make regressions blocking later, keep the compare step as-is and switch `"enforce": true` in [`policy.json`](./policy.json) once the team is ready.
