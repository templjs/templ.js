---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:068-remove-remaining-volar-statement-semantic-duplication
title: '068: Remove Remaining Volar Statement-Semantic Duplication'
summary: Remove Remaining Volar Statement-Semantic Duplication
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 4
actual: 0
---

## Goal

Replace the remaining Volar-local statement-semantic logic with thin adapters over core authority so diagnostics, completions, hover, and definition stay aligned.

## Background

Scope resolution is already core-backed, but diagnostics, IntelliSense, and related helpers still own parts of the semantic decision path that should be centralized.

## Tasks

- [ ] Audit remaining statement-semantic logic in Volar providers and helpers.
- [ ] Replace duplicated semantic derivation with core-backed adapters.
- [ ] Remove stale local heuristics once parity is proven.
- [ ] Add targeted regression and benchmark evidence.

## Acceptance Criteria

- [ ] Volar no longer duplicates statement-semantic logic that now exists in core.
- [ ] Provider behavior remains green with benchmarked before/after comparisons.
- [ ] Drift cases remain covered by regression tests.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
