---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:083-document-benchmark-workflow-semantic-ownership-schema-cache-and-test-conventions
title: '083: Document Benchmark Workflow, Semantic Ownership, Schema Cache, and Test Conventions'
summary: Document Benchmark Workflow, Semantic Ownership, Schema Cache, and Test Conventions
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
    - '[[record-20260514-223855-083-document-benchmark-workflow-semantic-ownership-schema-cache-and-test-conventions]]'
---

## Goal

Document the final benchmark workflow and the architectural/testing conventions introduced by the optimization program.

## Background

The benchmark workflow, parser-authority boundary, shared schema-analysis cache, and updated test conventions all need stable documentation once the implementation shape settles.

## Tasks

- [ ] Document how benchmark runs work locally and in CI/CD.
- [ ] Document semantic ownership boundaries between core, Volar, and VS Code.
- [ ] Document shared schema-analysis/cache expectations.
- [ ] Document final test-placement and behavior-first conventions.

## Acceptance Criteria

- [ ] Benchmark workflow documentation exists and matches the shipped commands/workflows.
- [ ] Semantic ownership is documented clearly enough to guide future contributors.
- [ ] Schema-cache expectations and test conventions are documented and linked from the relevant package guidance where appropriate.

## Relationships

- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
- `depends_on`: [[work-item-069-add-shared-schema-analysis-cache-in-core]]
- `depends_on`: [[work-item-082-remove-overlapping-test-coverage-and-add-shared-semantic-schema-fixtures]]
