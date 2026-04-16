---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:075-split-volar-context-graph-adapter-by-responsibility
title: '075: Split Volar Context-Graph Adapter by Responsibility'
summary: Split Volar Context-Graph Adapter by Responsibility
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

Split `context-graph-adapter.ts` into smaller responsibility-focused modules so schema lookup, scoped-path resolution, and graph orchestration are easier to optimize and test independently.

## Background

`context-graph-adapter.ts` remains one of the largest production files in the repo and still blends multiple semantic responsibilities.

## Tasks

- [ ] Identify adapter responsibilities and define smaller internal module boundaries.
- [ ] Extract the responsibilities into focused modules without changing public behavior.
- [ ] Keep graph-backed semantic reads and fallback behavior green.
- [ ] Attach benchmark deltas where the refactor changes hot paths.

## Acceptance Criteria

- [ ] Adapter responsibilities are separated into focused modules.
- [ ] Existing graph-backed authoring behavior remains green.
- [ ] The refactor is backed by before/after benchmark evidence where relevant.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-070-adopt-shared-schema-analysis-in-volar]]
