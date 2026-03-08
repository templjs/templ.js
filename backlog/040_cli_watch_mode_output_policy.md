---
id: wi-040
type: work-item
subtype: task
lifecycle: active
title: '40: Honor Output Mode Flags (--json, --quiet) in Watch Mode'
status: ready
priority: medium
estimated: 3
actual: 0
assignee: ''
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
    - '[[018_cli_watch_mode]]'
---

## Goal

Ensure `--json`, `--quiet`, and `--verbose` flags control output behavior consistently in watch mode, matching the output policy contract from non-watch commands.

## Background

PR 23 unresolved comment: Watch mode currently hands `startRenderWatchMode()` raw `defaultWatchModeDependencies`, so `--json` and `--quiet` stop applying as soon as watch mode starts. The watch loop emits plain stdout/stderr text, breaking machine-readable output and making `--quiet --watch` noisy.

Per coding guidelines: "Support JSON output format for machine readability in CLI commands"

## Tasks

- [ ] Plumb mode-aware writers into watch dependencies, OR
- [ ] Detect unsupported flag combinations and exit with clear error
- [ ] Ensure watch mode respects `mode.json`, `mode.quiet`, `mode.verbose`
- [ ] Add integration tests for watch mode with output flags
- [ ] Update documentation for watch mode output behavior

## Acceptance Criteria

- [ ] `--json --watch` produces JSON-formatted output
- [ ] `--quiet --watch` suppresses non-error output
- [ ] `--verbose --watch` shows detailed logging
- [ ] OR clear error message when combinations unsupported
- [ ] All watch mode tests pass with output policy variations

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901437330)
