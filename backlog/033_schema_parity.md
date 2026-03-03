---
id: wi-033
type: work-item
subtype: story
lifecycle: draft
title: '33: Implement Schema Parity (JSON/YAML/TOML Input Formats)'
status: proposed
priority: high
estimated: 12
assignee: ''
links:
  depends_on:
    - '[[017_cli_commands]]'
    - '[[008_query_engine]]'
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

- [ ] YAML input parsing and validation working
- [ ] TOML input parsing and validation working
- [ ] XML input parsing and validation working
- [ ] Schema validation works across all formats
- [ ] Format errors have clear messages
- [ ] Format auto-detection working
- [ ] 12+ tests passing
- [ ] No regressions in JSON handling

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

- [ ] Add YAML parser (libyaml or similar)
- [ ] Add TOML parser
- [ ] Add XML parser
- [ ] Format auto-detection by file extension
- [ ] Format-specific error handling
- [ ] Schema validation on parsed structures
- [ ] Type coercion if needed
- [ ] Document format-specific requirements
- [ ] Write tests (12+ tests)

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
