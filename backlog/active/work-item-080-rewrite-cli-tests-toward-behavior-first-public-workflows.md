---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:080-rewrite-cli-tests-toward-behavior-first-public-workflows
title: '080: Rewrite CLI Tests Toward Behavior-First Public Workflows'
summary: Rewrite CLI Tests Toward Behavior-First Public Workflows
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
    - '[[record-20260514-223855-080-rewrite-cli-tests-toward-behavior-first-public-workflows]]'
---

## Goal

Shift CLI tests away from internal call choreography and toward observable command behavior, public outputs, and real package integration.

## Background

Current CLI coverage remains heavily mock-driven, especially in the top-level CLI suite. That reduces confidence in the actual user-facing command paths.

## Tasks

- [ ] Identify mock-heavy CLI tests that can become behavior-first.
- [ ] Replace internal delegation assertions with public workflow assertions where feasible.
- [ ] Preserve a narrow set of boundary mocks only where process or OS behavior requires them.
- [ ] Keep coverage and signal quality at or above current levels.

## Acceptance Criteria

- [ ] CLI tests primarily assert exit codes, stdout/stderr, output files, and user-visible behavior.
- [ ] Internal delegation assertions are reduced to true boundary cases.
- [ ] CLI suites remain green after the rewrite.

## Relationships

- `depends_on`: [[work-item-071-adopt-shared-schema-analysis-in-cli]]
