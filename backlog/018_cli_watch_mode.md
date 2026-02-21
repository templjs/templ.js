---
id: wi-018
type: work-item
subtype: story
lifecycle: draft
title: '18: Add Watch Mode and File I/O'
status: proposed
priority: high
estimated: 6
assignee: ''
links:
  depends_on:
    - '[[017_cli_commands]]'
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

- [ ] Implement `--watch` flag for CLI commands
- [ ] Add file watcher using `chokidar` or chore Nodejs `fs.watch`
- [ ] Implement file streaming for large inputs
- [ ] Add configuration file loading (`.templjs.json`)
- [ ] Support environment variables in config
- [ ] Implement signal handling (SIGINT cleanup)
- [ ] Add progress indicators for large files
- [ ] Write 20+ tests for file I/O

## Deliverables

- Watch mode implementation
- File streaming support
- Config loading system
- 20+ passing tests

## Acceptance Criteria

- [ ] Watch mode detects file changes
- [ ] Re-renders within 500ms of change
- [ ] Works with stdin/stdout
- [ ] Config file loaded and applied
- [ ] Large files (>10MB) handled efficiently
- [ ] 20+ tests passing

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

- Requires: [[17 Implement CLI Commands]]
