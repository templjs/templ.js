---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:070-adopt-shared-schema-analysis-in-volar
title: '070: Adopt Shared Schema Analysis in Volar'
summary: Adopt Shared Schema Analysis in Volar
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 4
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-070-adopt-shared-schema-analysis-in-volar]]'
---

## Goal

Replace repeated Volar-local schema-analysis construction with the shared core schema-analysis path.

## Background

`context-graph-adapter` and `diagnostic-provider` still construct `SchemaValidator` instances directly for repeated metadata and validation work.

## Tasks

- [ ] Audit Volar schema-analysis entry points.
- [ ] Swap direct schema-validator construction for shared core analysis handles.
- [ ] Preserve current feature behavior while reducing repeated analysis cost.
- [ ] Record benchmark deltas for Volar schema-heavy scenarios.

## Acceptance Criteria

- [ ] Volar reuses shared schema analysis instead of rebuilding it opportunistically.
- [ ] Existing Volar schema-backed completions, diagnostics, and metadata behavior remain green.
- [ ] Benchmark evidence is attached to the implementation.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-069-add-shared-schema-analysis-cache-in-core]]
