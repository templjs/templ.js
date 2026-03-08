---
id: wi-035
type: work-item
subtype: task
lifecycle: active
title: '35: Fix Prefix-Overlapping Delimiter Matching in Volar'
status: ready
priority: medium
estimated: 2
actual: 0
assignee: ''
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
---

## Goal

Ensure custom template delimiters with shared prefixes (for example `<...>` and `<<...>>`) are matched deterministically and correctly.

## Background

Current regex alternation for delimiter blocks can match shorter prefixes before longer ones, producing incorrect block detection and degraded diagnostics/intellisense for custom delimiter configurations.

## Tasks

- [ ] Rework delimiter token ordering to prefer longest-prefix-first matching
- [ ] Add unit tests for prefix-overlap delimiter configurations
- [ ] Add integration regression in Volar custom delimiter E2E suite
- [ ] Verify diagnostics and mapping behavior for overlapping delimiters

## Acceptance Criteria

- [ ] Overlapping delimiter configurations parse expected blocks consistently
- [ ] Volar diagnostics/intellisense remain stable for custom delimiters
- [ ] New regression tests fail before fix and pass after fix
