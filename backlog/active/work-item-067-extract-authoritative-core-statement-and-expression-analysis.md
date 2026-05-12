---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:067-extract-authoritative-core-statement-and-expression-analysis
title: '067: Extract Authoritative Core Statement and Expression Analysis'
summary: Extract Authoritative Core Statement and Expression Analysis
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implemented
priority: medium
estimated: 5
actual: 3
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/116
---

## Goal

Move the remaining statement- and expression-semantic authority into `@templjs/core` so IDE consumers rely on one parser-backed source of truth instead of parallel semantic logic.

## Background

Delimiter-aware scope binding and declaration offsets are already in core, but Volar still owns expression-analysis utilities and some downstream consumers still reconstruct semantics locally.

## Tasks

- [x] Define the remaining additive core API for parser-backed statement and expression analysis.
- [x] Move or adapt the remaining reusable semantic logic into core.
- [x] Keep compatibility wrappers where needed while downstream consumers migrate.
- [x] Add benchmark cases and regression coverage for the new authority surface.

## Acceptance Criteria

- [x] The remaining reusable statement/expression semantic facts needed by IDE consumers are available from core.
- [x] New or migrated APIs are additive and benchmarked.
- [x] Core tests cover the authority surface and its delimiter-aware behavior.

## Implementation Notes

- Cite before/after benchmark cases from `WI-065` and `WI-066` in the final implementation evidence.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
