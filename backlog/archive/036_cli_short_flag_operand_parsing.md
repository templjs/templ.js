---
id: wi-036
type: work-item
subtype: task
lifecycle: active
title: '36: Harden CLI Short-Flag Operand Parsing in Output Policy'
status: closed
status_reason: obsolete
priority: low
estimated: 1
actual: 0
assignee: ''
start_date: 2026-03-08
end_date: 2026-03-08
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
notes:
  - timestamp: 2026-03-08T00:00:00Z
    note: |
      WI-036 already fixed in PR #23 commit ce96fda:
      - Added regex validation /^[A-Za-z]+$/ and /[^qv]/i filtering in output-policy.ts
      - Prevents operand-like values from being treated as short-flag bundles
      - Test coverage: src/packages/cli/test/output-policy.test.ts
      - All output-policy tests pass (4/4 passing)
      - Change implemented in src/packages/cli/src/output-policy.ts lines 49-56
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
