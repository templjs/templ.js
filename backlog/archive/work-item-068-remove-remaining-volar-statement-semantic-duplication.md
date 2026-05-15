---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:068-remove-remaining-volar-statement-semantic-duplication
title: '068: Remove Remaining Volar Statement-Semantic Duplication'
summary: Remove Remaining Volar Statement-Semantic Duplication
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 4
actual: 4
completed_date: '2026-05-14'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/125
  evidence:
    - '[[record-20260514-223855-068-remove-remaining-volar-statement-semantic-duplication]]'
---

## Goal

Replace the remaining Volar-local statement-semantic logic with thin adapters over core authority so diagnostics, completions, hover, and definition stay aligned.

## Background

Scope resolution is already core-backed, but diagnostics, IntelliSense, and related helpers still own parts of the semantic decision path that should be centralized.

## Tasks

- [x] Audit remaining statement-semantic logic in Volar providers and helpers.
- [x] Replace duplicated semantic derivation with core-backed adapters.
- [x] Remove stale local heuristics once parity is proven.
- [x] Add targeted regression and benchmark evidence.

## Acceptance Criteria

- [x] Volar no longer duplicates statement-semantic logic that now exists in core.
- [x] Provider behavior remains green with benchmarked before/after comparisons.
- [x] Drift cases remain covered by regression tests.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
