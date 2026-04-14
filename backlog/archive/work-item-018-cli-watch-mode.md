---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:018-cli-watch-mode
title: '18: Add Watch Mode and File I/O'
summary: Add Watch Mode and File I/O
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 6
actual: 6
completed_date: '2026-03-19'
commits:
  bfbed6b: 'feat(cli): implement WI-018 watch mode and file I/O'
  3a7f12f: 'fix(cli): update render stub comment and improve test assertions for watch mode'
  90abcbd: 'docs(backlog): link WI-018 to PR #22'
  a9bc36b: 'docs(backlog): record WI-018 commit history'
  2a79904: 'fix(cli): address PR #22 review feedback'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/22
  evidence:
    - '[[record-018-cli-watch-mode-evidence-1]]'
---

## Goal

Implement file watching, streaming I/O, and configuration loading for CLI.

## Background

Watch mode enables:

- Auto-rerender on input/template changes
- File streaming for large inputs
- Configuration loading from `.templjs.json`
- Output to file or stdout

## Tasks

- [x] Implement `--watch` flag for CLI commands
- [x] Add file watcher using `chokidar` or core Node.js `fs.watch`
- [x] Implement file streaming for large inputs
- [x] Add configuration file loading (`.templjs.json`)
- [x] Support environment variables in config
- [x] Implement signal handling (SIGINT cleanup)
- [x] Add progress indicators for large files
- [x] Write 20+ tests for file I/O

## Deliverables

- Watch mode implementation
- File streaming support
- Config loading system
- 20+ passing tests

## Acceptance Criteria

- [x] Watch mode detects file changes
- [x] Re-renders within 500ms of change
- [x] Works with stdin/stdout
- [x] Config file loaded and applied
- [x] Large files (>10MB) handled efficiently
- [x] 20+ tests passing

## Watch Mode Example

```bash
templjs render --watch --input data.json --template output.md.tmpl
# Re-renders on data.json or output.md.tmpl changes
```

## Configuration Precedence

1. CLI flags (highest priority)
2. `.templjs.json` in current directory
3. `.templjs.json` in parent directories
4. Default configuration (lowest priority)

## References

- [Chokidar Documentation](https://github.com/paulmillr/chokidar)
- [Node.js fs.watch](https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_callback)

## Dependencies

- Requires: [[work-item-017-cli-commands]]

## Status History

- 2026-03-04T10:20:00.000Z: `proposed` -> `ready`
- 2026-03-04T10:25:00.000Z: `ready` -> `in-progress`
- 2026-03-04T14:38:00.000Z: `in-progress` -> `ready-for-review`

## Implementation Notes (2026-03-04)

- Added `--watch` mode orchestration in CLI with debounced file watching and signal cleanup (`SIGINT`, `SIGTERM`).
- Added `watch-mode.ts` service with explicit dependency injection for deterministic tests.
- Added streaming read path for large input payloads (`>10MB`) with progress output to `stderr`.
- Added stdin payload support via `--input -` and preserved stdout output defaults.
- Extended `.templjs.json` loader with environment variable interpolation (`${VAR}` and `${VAR:-fallback}`).
- Expanded CLI test suite to 70 passing tests, including watch-mode lifecycle behavior and large-file/config-env scenarios.

## Relationships

- `depends_on`: [[work-item-017-cli-commands]]
