---
id: wi-017
type: work-item
subtype: story
lifecycle: active
title: '17: Implement CLI Commands MVP (render, validate, init)'
status: closed
status_reason: completed
priority: critical
estimated: 10
assignee: ''
actual: 8.5
completed_date: 2026-03-03
links:
  depends_on:
    - '[[007_ast_renderer]]'
    - '[[008_query_engine]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/18'
commits:
  83f6048: 'feat(cli): implement render/validate/init commands'
  8830b28: 'docs(backlog): mark WI-030, WI-017, WI-016 as closed'
test_results:
  - timestamp: 2026-03-03T08:15:00Z
    note: |
      @templjs/cli test: 13/13 tests passing
      - index.test.ts: 3 tests
      - init.test.ts: 3 tests (NEW)
      - render.test.ts: 4 tests (enhanced)
      - validate.test.ts: 3 tests (enhanced)

      Builds: @templjs/core build ✅, @templjs/cli build ✅
      ESLint: All checks pass (error cause preservation)
      Coverage: Test infrastructure ready for phase 4 metric integration
---

## Goal

Build command-line interface for template rendering, validation, and initialization.

## Background

CLI provides programmatic access to templ.js:

- `render`: Transform data with template
- `validate`: Check template and data against schema
- `init`: Generate sample template for format

**Related ADRs**: [[ADR-004 Branding]]

## Tasks (MVP)

- [x] Setup Commander.js for CLI framework
- [x] Implement `render` command with validation integration
  - [x] Basic render with file I/O and JSON parsing
  - [x] Error handling with cause preservation per ESLint rules
- [x] Implement `validate` command
- [x] Implement `init` command
- [x] Add input format detection (JSON via file existence check)
- [x] Add output format handling (stdout, file)
- [x] Add error reporting with clear messages

## Deliverables (MVP)

- Fully functional CLI with 3 commands (render, validate, init)
- Input format handling (JSON file/inline)
- Output routing (stdout, file)
- File I/O support

## Future Deliverables

- Config file support (WI-032)
- Help documentation (WI-020)
- Schema-driven validation (WI-033)
- Watch mode (WI-018)

## Acceptance Criteria (MVP)

- [x] `templjs render` works with JSON input (file or inline)
- [x] `templjs validate` checks template syntax
- [x] `templjs init` generates sample templates for JSON/YAML/Markdown/HTML
- [x] Error messages are helpful with cause preservation
- [x] File I/O works correctly (readFileSync/writeFileSync)
- [x] All 13 tests passing

## Completion Notes

Successfully scaffolded CLI with three core commands:

1. **Command Infrastructure**:
   - Commander.js framework set up with proper program builder
   - Option parsing for required flags (--template, --input) and optional (--output, --schema)
   - Output routing to stdout or file

2. **Core Commands Implemented**:
   - `render`: Template file + JSON input → rendered output
   - `validate`: Template validation with schema awareness (basic)
   - `init`: Starter template generation for multiple formats

3. **Quality**:
   - 13 unit tests passing
   - File I/O operations tested
   - Error handling with proper cause chaining per preserve-caught-error ESLint rule
   - Both core and CLI builds succeed

4. **Deferred Work** (follow-up items):
   - Config file integration (.templjs.json) → WI-032
   - Schema parity across input formats → WI-033
   - Watch mode for continuous rendering → WI-018
   - CLI documentation and help → WI-020

CLI foundation is ready for phase 4 feature expansion and documentation.

## Commands

### render

```bash
# Render with auto-validation (if schema provided)
templjs render --input data.json --template output.md.tmpl --output result.md
templjs render --input data.json --template output.md.tmpl  # stdout

# Explicit validation mode
templjs render --input data.json --template output.md.tmpl --schema input-schema.json
templjs render --input data.json --template output.md.tmpl --validate-output output-schema.json

# Disable validation (opt-out)
templjs render --input data.json --template output.md.tmpl --no-validate-input
templjs render --input data.json --template output.md.tmpl --no-validate-output

# stdin/stdout pipes
cat data.json | templjs render --template output.md.tmpl > result.md
```

### validate

```bash
# Validate input data against schema
templjs validate --template report.md.tmpl --input data.json --schema input-schema.json

# Validate rendered output
templjs validate --template report.md.tmpl --output output.md --schema output-schema.json
```

### init

```bash
templjs init --format markdown  # Creates sample markdown template
```

## Configuration File

```json
{
  "inputFormat": "json",
  "outputFormat": "text",
  "templateDelimiters": {
    "statement_start": "{%",
    "statement_end": "%}",
    "expression_start": "{{",
    "expression_end": "}}"
  }
}
```

## References

- [Commander.js Documentation](https://github.com/tj/commander.js)

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]], [[7 Implement AST Renderer]]
- Parallel with: [[18 Add Watch Mode and File I/O]]
