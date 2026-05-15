---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:078-colocate-core-and-context-graph-module-tests-with-sources
title: '078: Co-Locate Core and Context-Graph Module Tests with Sources'
summary: Co-Locate Core and Context-Graph Module Tests with Sources
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
    - '[[record-20260514-223855-078-colocate-core-and-context-graph-module-tests-with-sources]]'
---

## Goal

Move core and context-graph module-focused tests beside their primary source modules and split centralized suites until module ownership is explicit.

## Background

Core still carries most of its unit and module coverage under package-level `test/` directories, including some of the largest suites in the repo.

## Tasks

- [ ] Inventory current core and context-graph suites by primary target module.
- [ ] Move module-focused suites beside their owning source modules.
- [ ] Split umbrella suites where one file still covers multiple primary modules.
- [ ] Preserve public API and integration coverage where centralized placement remains justified.

## Acceptance Criteria

- [ ] Core and context-graph module-focused tests are colocated with their primary modules.
- [ ] Retained centralized suites are limited to explicit integration or boundary coverage.
- [ ] Package tests still pass after the migration.

## Relationships

- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
- `depends_on`: [[work-item-069-add-shared-schema-analysis-cache-in-core]]
- `depends_on`: [[work-item-073-optimize-context-graph-query-indexes-and-ordering]]
- `depends_on`: [[work-item-074-reuse-query-engine-builtin-registry-and-metadata]]
