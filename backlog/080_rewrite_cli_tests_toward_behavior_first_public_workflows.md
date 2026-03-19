---
id: wi-080
type: work-item
subtype: task
lifecycle: draft
title: '080: Rewrite CLI Tests Toward Behavior-First Public Workflows'
status: proposed
priority: medium
estimated: 4
actual: 0
assignee: ''
links:
  implements:
    - '[[064_benchmark_first_repo_optimization_program]]'
  depends_on:
    - '[[071_adopt_shared_schema_analysis_in_cli]]'
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
