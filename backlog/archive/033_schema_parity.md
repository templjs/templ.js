---
id: wi-033
type: work-item
subtype: story
lifecycle: active
title: '33: Implement Schema Parity (JSON/YAML/TOML Input Formats)'
status: closed
status_reason: completed
priority: high
estimated: 12
assignee: ''
actual: 13
completed_date: '2026-03-19'
commits:
  78e3fbd: 'fix(backlog,formats): address PR #24 major blocking issues'
  f1394b6: 'docs(wi-033): add PR metadata to backlog item'
  f6eb420: 'feat(cli): implement WI-033 schema parity with multi-format input parsing'
links:
  depends_on:
    - '[[017_cli_commands]]'
    - '[[008_query_engine]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/24
test_results:
  - timestamp: 2026-03-05T21:45:00Z
    note: |
      WI-033 schema parity implementation validation:
      - Multi-format parsing: JSON, YAML, TOML, XML all working
      - Format detection: All extensions detected (.json, .yaml, .yml, .toml, .xml)
      - Format-specific errors with clear messages ("Invalid JSON:", "Invalid YAML:", etc)
      - Stdin support (path="-") defaults to JSON automatically
      - Test coverage: 48 format-parity tests + 84 existing = 132 total CLI tests
      - All 8 acceptance criteria met with zero regressions
      - Statement coverage: 96.85% (95% threshold), Branch: 90% (78% threshold)
  - timestamp: 2026-03-07T00:00:00Z
    note: |
      Ready for review: All acceptance criteria met, 13 hours invested.
      PR #24 ready for merge. Moving to ready-for-review status.
---

## Goal

Enable CLI to validate input data against schema regardless of input format (JSON, YAML, TOML, XML).

## Background

WI-017 implemented basic CLI commands with JSON input. This work item extends validation to:

1. Accept input in multiple formats (YAML, TOML, XML)
2. Validate all formats against same schema
3. Provide format-specific error messages
4. Handle format-specific parsing requirements

## Acceptance Criteria

- [x] YAML input parsing and validation working
- [x] TOML input parsing and validation working
- [x] XML input parsing and validation working
- [x] Schema validation works across all formats
- [x] Format errors have clear messages
- [x] Format auto-detection working
- [x] 48+ tests passing (exceeds 12+ requirement)
- [x] No regressions in JSON handling

## Input Formats

### JSON (Completed in WI-017)

```bash
templjs render --input data.json --template output.md.tmpl
```

### YAML (New)

```bash
templjs render --input data.yaml --template output.md.tmpl
templjs render --input data.yml --template output.md.tmpl
```

### TOML (New)

```bash
templjs render --input config.toml --template output.md.tmpl
```

### XML (New)

```bash
templjs render --input data.xml --template output.md.tmpl
```

## Tasks

- [x] Add YAML parser (libyaml or similar)
- [x] Add TOML parser
- [x] Add XML parser
- [x] Format auto-detection by file extension
- [x] Format-specific error handling
- [x] Schema validation on parsed structures
- [x] Type coercion if needed
- [x] Document format-specific requirements
- [x] Write tests (12+ tests)

## Implementation Notes

- Query engine (@templjs/core) should handle parsed/normalized structures uniformly
- All formats parse to JavaScript objects that match schema
- Invalid format should have clear errors ("Invalid YAML: ..." vs generic JSON error)

## Dependencies

- Requires: WI-017 (core CLI), WI-008 (query engine)
- Parallel with: WI-032 (config files)

## Related Items

- WI-017: Core CLI commands (completed)
- WI-032: Config file support
- WI-018: Watch mode

## Testing Strategy

Test matrix: format × validation scenario

- YAML valid/invalid
- TOML valid/invalid
- XML valid/invalid
- Schema validation across formats
- Format auto-detection
- Mixed format in monorepo
