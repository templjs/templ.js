---
id: wi-029
type: work-item
subtype: task
lifecycle: draft
title: '029: Implement CLI Signal Handling and Advanced I/O'
status: proposed
priority: critical
estimated: 6
assignee: ''
links:
  depends_on:
    - '[[017_cli_commands]]'
---

## Goal

Add robust Unix pipeline support with signal handling, TTY detection, context-aware error messages, and streaming for large files.

## Background

CLI must be a good Unix citizen: handle signals gracefully (SIGINT, SIGPIPE, SIGTERM), support streaming I/O for large inputs, provide helpful error context with code snippets.

**Related ADRs**: [[ADR-005 Monorepo Structure]]

## Tasks

- [ ] Implement TTY detection (`process.stdin.isTTY`):
  - Interactive mode vs pipe mode
  - Different timeout for each mode
- [ ] Implement signal handlers:
  - SIGINT (Ctrl+C): Clean shutdown, exit code 130
  - SIGTERM: Graceful cleanup
  - SIGPIPE: Silent exit (broken pipe in pipelines)
- [ ] Implement error context snippets:
  - Show 3 lines before/after error location
  - Highlight error column with ASCII `^` marker
  - Include line numbers
- [ ] Add verbosity control:
  - `--quiet`: No output except errors
  - `--verbose`: Show debug info and timing
  - `--json`: JSON output for machine parsing
- [ ] Implement streaming for large files:
  - Handle >1MB inputs without buffering issues
  - Respect memory limits
  - Progress indicators for large renders
- [ ] Add comprehensive error messages:
  - Template syntax errors with context
  - Data parsing errors (JSON/YAML/TOML)
  - File not found with suggestions
  - Permission denied errors
- [ ] Write 15+ tests for I/O and signals

## Deliverables

- Signal handler registration
- TTY-aware stdin/stdout handling
- Error formatter with context snippets
- Streaming I/O support
- 15+ passing I/O tests

## Acceptance Criteria

- [ ] Reads files >10MB efficiently
- [ ] SIGPIPE exits silently without error
- [ ] Error messages show code context
- [ ] Column errors marked with `^`
- [ ] Ctrl+C exits cleanly (code 130)
- [ ] TTY detection works (interactive vs pipe)
- [ ] Works in pipeline: `cat template.tmpl | templjs render --input data.json`
- [ ] 15+ tests passing

## Error Context Example

```stdout
Error: Undefined variable on line 5

  3 | Users:
  4 | {% for user in users %}
  5 | Name: {{ user.name }}
  6 |       ^^^^^^^^^^^^^^^
  7 | {% endfor %}

Did you mean: user.firstName or user.email?
```

## References

- Node.js Streams: <https://nodejs.org/api/stream.html>
- Signal handling: <https://nodejs.org/api/process.html#process_signal_events>

## Dependencies

- Requires: [[17 Implement CLI Commands]], [[18 Add Watch Mode and File I/O]]
- Unblocks: [[19 Write CLI Tests]]
