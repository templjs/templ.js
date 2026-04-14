---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:040-cli-watch-mode-output-policy
title: '40: Honor Output Mode Flags (--json, --quiet) in Watch Mode'
summary: Honor Output Mode Flags (--json, --quiet) in Watch Mode
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 3
actual: 3
completed_date: '2026-04-05'
commits:
  f5979e5: 'fix(cli): honor json and quiet output policies in watch mode (WI-040)'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
    - https://github.com/templjs/templ.js/pull/42
    - https://github.com/templjs/templ.js/pull/43
  evidence:
    - '[[record-040-cli-watch-mode-output-policy-evidence-1]]'
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

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
- `depends_on`: [[work-item-018-cli-watch-mode]]
