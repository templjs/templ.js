---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:071-adopt-shared-schema-analysis-in-cli
title: '071: Adopt Shared Schema Analysis in CLI'
summary: Adopt Shared Schema Analysis in CLI
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
    - '[[record-20260514-223855-071-adopt-shared-schema-analysis-in-cli]]'
---

## Goal

Move CLI schema validation and metadata reads onto the shared core schema-analysis path.

## Background

The CLI still constructs `SchemaValidator` directly in its validation command, making it one of the remaining direct adopters that should align with the shared cache.

## Tasks

- [ ] Migrate CLI schema-validation call sites to the shared analysis path.
- [ ] Preserve existing CLI output and error behavior.
- [ ] Attach benchmark evidence for CLI schema-backed flows.

## Acceptance Criteria

- [ ] CLI no longer bypasses the shared core schema-analysis path.
- [ ] Current CLI schema behavior remains compatible.
- [ ] Benchmark evidence is captured for the migration.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-069-add-shared-schema-analysis-cache-in-core]]
