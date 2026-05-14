---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:079-colocate-volar-and-vscode-module-tests-with-sources
title: '079: Co-Locate Volar and VS Code Module Tests with Sources'
summary: Co-Locate Volar and VS Code Module Tests with Sources
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
    - '[[record-20260514-223855-079-colocate-volar-and-vscode-module-tests-with-sources]]'
---

## Goal

Move Volar and VS Code module-focused tests beside their primary source modules and limit remaining central test directories to explicit integration cases.

## Background

Volar and VS Code still keep most module suites under centralized `test/` directories, even when a suite clearly protects one production module.

## Tasks

- [ ] Map current Volar and VS Code test files to their primary target modules.
- [ ] Co-locate module-focused suites with their source modules.
- [ ] Retain only clearly justified integration or process-boundary suites in centralized test directories.
- [ ] Preserve public behavior and test discovery during the migration.

## Acceptance Criteria

- [ ] Volar and VS Code module-focused tests are colocated with their primary modules.
- [ ] Remaining centralized suites are explicitly integration-oriented.
- [ ] Package tests still pass after the migration.

## Relationships

- `depends_on`: [[work-item-068-remove-remaining-volar-statement-semantic-duplication]]
- `depends_on`: [[work-item-070-adopt-shared-schema-analysis-in-volar]]
- `depends_on`: [[work-item-075-split-volar-context-graph-adapter-by-responsibility]]
- `depends_on`: [[work-item-076-split-volar-intellisense-and-diagnostic-providers-by-responsibility]]
- `depends_on`: [[work-item-077-split-vscode-server-into-schema-state-and-lsp-services]]
