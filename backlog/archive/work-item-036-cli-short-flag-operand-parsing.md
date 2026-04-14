---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:036-cli-short-flag-operand-parsing
title: '36: Harden CLI Short-Flag Operand Parsing in Output Policy'
summary: Harden CLI Short-Flag Operand Parsing in Output Policy
assignee: squirrel289
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: low
estimated: 1
actual: 1
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-036-cli-short-flag-operand-parsing-evidence-1]]'
---

## Goal

Prevent output-mode short-flag pre-parse logic from interpreting operand-like values (for example `-quiet.txt`) as bundled flags.

## Background

`resolveOutputModeFromArgv()` performs early flag scanning before Commander parsing. Current behavior can over-match malformed or operand-like values beginning with `-`.

## Tasks

- [x] Restrict short-flag bundle detection to known, valid short options
- [x] Add focused parser tests for operand-like values and mixed bundles
- [x] Verify no regressions for `-q`, `-v`, combined short flags, and `--json`

## Acceptance Criteria

- [x] Operand-like tokens are not treated as short-flag bundles
- [x] Existing output mode precedence behavior remains unchanged
- [x] Output policy tests fully pass with added cases

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
