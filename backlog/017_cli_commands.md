---
id: wi-017
type: work-item
subtype: story
lifecycle: draft
title: '17: Implement CLI Commands (render, validate, init)'
status: proposed
priority: critical
estimated: 10
assignee: ''
links:
  depends_on:
    - '[[007_ast_renderer]]'
    - '[[008_query_engine]]'
---

## Goal

Build command-line interface for template rendering, validation, and initialization.

## Background

CLI provides programmatic access to templ.js:

- `render`: Transform data with template
- `validate`: Check template and data against schema
- `init`: Generate sample template for format

**Related ADRs**: [[ADR-004 Branding]]

## Tasks

- [ ] Setup Commander.js for CLI framework
- [ ] Implement `render` command with validation integration
  - [ ] Enable validation by default if schema provided (via template or CLI)
  - [ ] Support `--no-validate-input` and `--no-validate-output` for opt-out
- [ ] Implement `validate` command
- [ ] Implement `init` command
- [ ] Add input format detection (JSON, YAML, TOML, XML)
- [ ] Add output format handling (stdout, file)
- [ ] Add error reporting with clear messages (validation errors include paths)
- [ ] Support config files (`.templjs.json`) with validation settings
- [ ] Write CLI help documentation

## Deliverables

- Fully functional CLI with 3 commands
- Config file support
- Help documentation
- Input/output handling

## Acceptance Criteria

- [ ] `templjs render` works with JSON input
- [ ] `templjs validate` checks schema compatibility
- [ ] `templjs init` generates sample templates
- [ ] `templjs --help` shows all commands
- [ ] Error messages are helpful
- [ ] File I/O works correctly

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
