---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:069-add-shared-schema-analysis-cache-in-core
title: '069: Add Shared Schema Analysis Cache in Core'
summary: Add Shared Schema Analysis Cache in Core
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: reverting-for-pr-workflow
priority: medium
estimated: 6
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-069-add-shared-schema-analysis-cache-in-core]]'
---

## Goal

Create one shared schema-analysis cache in `@templjs/core` so schema compilation, metadata extraction, and path analysis are reused instead of rebuilt at each call site.

## Background

Current repo analysis still shows repeated `SchemaValidator` construction in Volar and CLI call paths. That makes schema-related work a clear performance and memory target once benchmarks exist.

## Tasks

- [x] Design shared cache ownership and cache keys for schema analysis.
- [x] Cache compiled validators, metadata, valid paths, and related analysis together.
- [x] Keep `SchemaValidator` as the public facade where compatibility is needed.
- [x] Add benchmark coverage for cold and warm schema-analysis paths.

## Acceptance Criteria

- [ ] Core exposes a reusable schema-analysis path backed by shared caching.
- [ ] Existing public schema validation behavior remains compatible.
- [ ] Benchmarks demonstrate cold vs warm behavior and are published through the benchmark pipeline.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
