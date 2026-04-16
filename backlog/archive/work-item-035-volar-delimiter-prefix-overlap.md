---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:035-volar-delimiter-prefix-overlap
title: '35: Fix Prefix-Overlapping Delimiter Matching in Volar'
summary: Fix Prefix-Overlapping Delimiter Matching in Volar
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: obsolete
priority: medium
estimated: 2
actual: 0
commits:
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-035-volar-delimiter-prefix-overlap-evidence-1]]'
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

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
