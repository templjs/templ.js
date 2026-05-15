---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:082-remove-overlapping-test-coverage-and-add-shared-semantic-schema-fixtures
title: '082: Remove Overlapping Test Coverage and Add Shared Semantic/Schema Fixtures'
summary: Remove Overlapping Test Coverage and Add Shared Semantic/Schema Fixtures
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
    - '[[record-20260514-223855-082-remove-overlapping-test-coverage-and-add-shared-semantic-schema-fixtures]]'
---

## Goal

Reduce duplicate test coverage and replace copy-pasted scenario setup with shared semantic and schema fixture matrices.

## Background

Once test placement and behavior shape are improved, the next cleanup step is removing duplicate scenario proof and standardizing reusable fixture inputs across layers.

## Tasks

- [ ] Inventory repeated semantic and schema scenarios across packages.
- [ ] Create shared fixture inputs for the repeated cases.
- [ ] Remove overlapping tests once canonical coverage is in place.
- [ ] Keep one clear regression per bug class or behavior class.

## Acceptance Criteria

- [ ] Repeated semantic and schema scenarios use shared fixtures where practical.
- [ ] Duplicate behavior coverage is removed without losing regression protection.
- [ ] Test suites remain green after consolidation.

## Relationships

- `depends_on`: [[work-item-078-colocate-core-and-context-graph-module-tests-with-sources]]
- `depends_on`: [[work-item-079-colocate-volar-and-vscode-module-tests-with-sources]]
- `depends_on`: [[work-item-080-rewrite-cli-tests-toward-behavior-first-public-workflows]]
- `depends_on`: [[work-item-081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage]]
