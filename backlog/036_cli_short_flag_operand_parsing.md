---
id: wi-036
type: work-item
subtype: task
lifecycle: active
title: '36: Harden CLI Short-Flag Operand Parsing in Output Policy'
status: ready
priority: low
estimated: 1
actual: 0
assignee: ''
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
---

## Goal

Prevent output-mode short-flag pre-parse logic from interpreting operand-like values (for example `-quiet.txt`) as bundled flags.

## Background

`resolveOutputModeFromArgv()` performs early flag scanning before Commander parsing. Current behavior can over-match malformed or operand-like values beginning with `-`.

## Tasks

- [ ] Restrict short-flag bundle detection to known, valid short options
- [ ] Add focused parser tests for operand-like values and mixed bundles
- [ ] Verify no regressions for `-q`, `-v`, combined short flags, and `--json`

## Acceptance Criteria

- [ ] Operand-like tokens are not treated as short-flag bundles
- [ ] Existing output mode precedence behavior remains unchanged
- [ ] Output policy tests fully pass with added cases
