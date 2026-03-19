---
id: wi-035
type: work-item
subtype: task
lifecycle: active
title: '35: Fix Prefix-Overlapping Delimiter Matching in Volar'
status: closed
status_reason: obsolete
priority: medium
estimated: 2
actual: 0
assignee: ''
start_date: 2026-03-08
end_date: 2026-03-08
commits:
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
notes:
  - timestamp: 2026-03-08T00:00:00Z
    note: |
      WI-035 already fixed in PR #23 commit 8900fcc:
      - Added hasPrefixOverlap() validation to resolveDelimiters()
      - Throws error when start/end delimiters overlap by prefix
      - Test coverage: src/packages/volar/test/template-delimiters.test.ts
      - Regression test verifies '<' and '<<' configuration throws /overlap/i error
      - All delimiter tests pass (4/4 passing)
      - Change implemented in src/packages/volar/src/template-delimiters.ts lines 42-61
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
