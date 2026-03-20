---
id: coverage-strategy-001
type: document
subtype: runbook
lifecycle: active
status: ready
title: 'Coverage Strategy (WI-034)'
---

## Purpose

Define the coverage policy used to enforce ADR-006 quality gates across the templjs monorepo.

## ADR-006 Targets

- Global baseline: 90% lines, functions, branches, statements
- `@templjs/core`: 95% on all metrics
- `@templjs/cli`: 85% on all metrics
- `@templjs/volar`: 92% on all metrics
- `vscode-templjs`: 90% on all metrics

## Enforcement Rules

- Coverage provider: `v8`
- Coverage thresholds are configured in `vitest.config.ts` and package-level configs.
- `perFile: true` is enabled so low-coverage files cannot be hidden by high-coverage neighbors.
- Threshold drift is disabled (`autoUpdate: false`) to prevent accidental rebaselining.

## Variance and Remediation Workflow

1. Run package coverage locally to identify failing files and metrics.
2. Categorize each failing file by gap size:
   - High gap: greater than 3% below target
   - Medium gap: 1-3% below target
   - Low gap: less than 1% below target
3. Close gaps with targeted tests first.
4. If a gap cannot be closed immediately, document rationale and track follow-up work item(s).
5. Do not relax package thresholds to satisfy short-term failures.

## Commands

- Root gate: `pnpm run test:affected:ci`
- Core coverage: `pnpm --filter @templjs/core exec vitest run --coverage`
- CLI coverage: `pnpm --filter @templjs/cli exec vitest run --coverage`
- Volar coverage: `pnpm --filter @templjs/volar exec vitest run --coverage`
- VS Code coverage: `pnpm --filter vscode-templjs exec vitest run --coverage`

## WI-034 Notes

WI-034 tracks the transition from baseline-style thresholds to ADR-aligned thresholds with per-file enforcement. Failures surfaced by this strategy are treated as actionable coverage debt and must be addressed through tests or explicit, documented exceptions.
