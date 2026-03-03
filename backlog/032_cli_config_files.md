---
id: wi-032
type: work-item
subtype: story
lifecycle: draft
title: '32: Add CLI Config File Support (.templjs.json)'
status: proposed
priority: high
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[017_cli_commands]]'
---

## Goal

Add configuration file support for CLI to enable persistent settings and reduce command-line verbosity.

## Background

WI-017 implemented core CLI commands with command-line flag options. This work item adds configuration file support to:

1. Reduce repetitive flag passing
2. Store defaults per project
3. Enable schema and validation settings to be project-wide
4. Support multiple output formats and template delimiters

## Acceptance Criteria

- [ ] `.templjs.json` config file parsed correctly
- [ ] Config file located (current dir, then parent dirs up to root)
- [ ] CLI flags override config file settings
- [ ] All core commands respect config (render, validate, init)
- [ ] Config validation (JSON schema)
- [ ] Error handling for invalid config
- [ ] Clear error messages for missing config
- [ ] Documentation on config file format
- [ ] 8+ tests passing

## Config File Format

```json
{
  "inputFormat": "json",
  "outputFormat": "text",
  "defaultTemplate": "template.tmpl",
  "defaultOutput": "output.json",
  "templateDelimiters": {
    "statement_start": "{%",
    "statement_end": "%}",
    "expression_start": "{{",
    "expression_end": "}}"
  },
  "validation": {
    "validateInput": true,
    "validateOutput": false,
    "schemaPath": "schema.json"
  }
}
```

## Tasks

- [ ] Design config file schema
- [ ] Implement config file discovery (.templjs.json search)
- [ ] Parse config file (JSON)
- [ ] Merge config with CLI flags (flags take precedence)
- [ ] Apply config to all commands
- [ ] Validate config against schema
- [ ] Error handling for missing/invalid config
- [ ] Document config format
- [ ] Write tests (8+ tests)

## Related Items

- WI-017: Core CLI commands (completed)
- WI-033: Schema parity across formats
- WI-018: Watch mode

## Implementation Notes

- Use same delimiter structure as @templjs/core for consistency
- Support environment variable substitution in config? (TBD)
- Consider cascade from project root to monorepo root (for Nx workspaces)
