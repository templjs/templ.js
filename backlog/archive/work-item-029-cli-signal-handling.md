---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:029-cli-signal-handling
title: '029: Implement CLI Signal Handling and Advanced I/O'
summary: Implement CLI Signal Handling and Advanced I/O
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: merged_to_main
priority: critical
estimated: 6
actual: 6
commits:
  fe801d3: 'test(signal-handler): add timeout and non-Error exception coverage'
  31c23a0: 'fix(signal-handler): prevent infinite hang with handler timeout'
  9cb775e: 'docs(wi-029): add PR metadata to backlog item'
  d101044: 'feat(cli): implement WI-029 signal handling, TTY detection, error formatting, and streaming I/O'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-029-cli-signal-handling-evidence-1]]'
    - '[[record-029-cli-signal-handling-evidence-2]]'
    - '[[record-029-cli-signal-handling-evidence-3]]'
    - '[[record-029-cli-signal-handling-evidence-4]]'
    - '[[record-029-cli-signal-handling-evidence-5]]'
---

## Goal

Add robust Unix pipeline support with signal handling, TTY detection, context-aware error messages, and streaming for large files.

## Background

CLI must be a good Unix citizen: handle signals gracefully (SIGINT, SIGPIPE, SIGTERM), support streaming I/O for large inputs, provide helpful error context with code snippets.

**Related ADRs**: [[ADR-005 Monorepo Structure]]

## Tasks

- [x] Implement TTY detection (`process.stdin.isTTY`):
  - Interactive mode vs pipe mode
  - Different timeout for each mode
- [x] Implement signal handlers:
  - SIGINT (Ctrl+C): Clean shutdown, exit code 130
  - SIGTERM: Graceful cleanup
  - SIGPIPE: Silent exit (broken pipe in pipelines)
- [x] Implement error context snippets:
  - Show 3 lines before/after error location
  - Highlight error column with ASCII `^` marker
  - Include line numbers
- [x] Add verbosity control:
  - `--quiet`: No output except errors
  - `--verbose`: Show debug info and timing
  - `--json`: JSON output for machine parsing
- [x] Implement streaming for large files:
  - Handle >=10MB inputs without buffering issues
  - Respect memory limits
  - Progress indicators for large renders
- [x] Add comprehensive error messages:
  - Template syntax errors with context
  - Data parsing errors (JSON/YAML/TOML)
  - File not found with suggestions
  - Permission denied errors
- [x] Write 15+ tests for I/O and signals (41 tests total)

## Deliverables

- Signal handler registration
- TTY-aware stdin/stdout handling
- Error formatter with context snippets
- Streaming I/O support
- 41 passing I/O and signal tests (exceeds 15+ requirement)

## Acceptance Criteria

- [x] Reads files >=10MB efficiently (validated: 10MB file uses < 5MB heap growth)
- [x] SIGPIPE exits silently without error (exit code 141)
- [x] Error messages show code context (3 lines before/after)
- [x] Column errors marked with `^`
- [x] Ctrl+C exits cleanly (code 130)
- [x] TTY detection works (interactive vs pipe)
- [x] Works in pipeline: `cat template.tmpl | templjs render --input data.json`
- [x] 41 tests passing (exceeds 15+ requirement)

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

## Relationships

- `depends_on`: [[work-item-017-cli-commands]]
