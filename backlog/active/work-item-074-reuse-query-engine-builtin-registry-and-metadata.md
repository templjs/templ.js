---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:074-reuse-query-engine-builtin-registry-and-metadata
title: '074: Reuse Query-Engine Builtin Registry and Metadata'
summary: Reuse Query-Engine Builtin Registry and Metadata
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 3
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-074-reuse-query-engine-builtin-registry-and-metadata]]'
---

## Goal

Remove repeated builtin registration and metadata construction from `QueryEngine` instance setup while preserving current query behavior.

## Background

The utility signature mismatch has already been corrected on `main`, but the engine still rebuilds builtin registry and metadata state for each new instance.

## Tasks

- [ ] Extract shared immutable builtin registry and metadata defaults.
- [ ] Keep per-instance mutable variable metadata behavior intact.
- [ ] Add benchmark cases for query-engine construction and representative query execution.

## Acceptance Criteria

- [ ] Builtin registry and metadata setup is shared rather than rebuilt for every engine instance.
- [ ] Existing query behavior and metadata access remain compatible.
- [ ] Benchmark evidence is captured for initialization and steady-state behavior.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
