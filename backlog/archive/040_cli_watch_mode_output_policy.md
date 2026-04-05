---
id: wi-040
type: work-item
subtype: task
lifecycle: active
title: '40: Honor Output Mode Flags (--json, --quiet) in Watch Mode'
status: closed
status_reason: completed
completed_date: '2026-04-05'
priority: medium
estimated: 3
actual: 3
assignee: ''
commits:
  f5979e5: 'fix(cli): honor json and quiet output policies in watch mode (WI-040)'
test_results:
  - timestamp: 2026-03-23T08:17:43Z
    note: |
      Implemented mode-aware watch writers in CLI render flow:
      - `--json --watch` now emits JSON envelopes for render success and errors
      - `--quiet --watch` suppresses non-error output (including startup banner)
      - `--verbose --watch` remains available for diagnostics
      Verification:
      - `src/packages/cli/test/cli.test.ts` + `src/packages/cli/test/watch-mode.test.ts` (52 passed)
      - Full CLI suite (247 passed)
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
    - '[[018_cli_watch_mode]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/23'
    - 'https://github.com/templjs/templ.js/pull/42'
---

## Goal

Ensure `--json`, `--quiet`, and `--verbose` flags control output behavior consistently in watch mode, matching the output policy contract from non-watch commands.

## Background

PR 23 unresolved comment: Watch mode currently hands `startRenderWatchMode()` raw `defaultWatchModeDependencies`, so `--json` and `--quiet` stop applying as soon as watch mode starts. The watch loop emits plain stdout/stderr text, breaking machine-readable output and making `--quiet --watch` noisy.

Per coding guidelines: "Support JSON output format for machine readability in CLI commands"

## Tasks

- [x] Plumb mode-aware writers into watch dependencies, OR
- [x] Detect unsupported flag combinations and exit with clear error
- [x] Ensure watch mode respects `mode.json`, `mode.quiet`, `mode.verbose`
- [x] Add integration tests for watch mode with output flags
- [x] Update documentation for watch mode output behavior

## Acceptance Criteria

- [x] `--json --watch` produces JSON-formatted output
- [x] `--quiet --watch` suppresses non-error output
- [x] `--verbose --watch` shows detailed logging
- [x] OR clear error message when combinations unsupported
- [x] All watch mode tests pass with output policy variations

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901437330)
