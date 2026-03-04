---
id: wi-032
type: work-item
subtype: story
lifecycle: active
title: '32: Add CLI Config File Support (.templjs.json)'
status: ready-for-review
priority: high
estimated: 8
assignee: ''
completed_date: 2026-03-04
actual: 8
links:
  depends_on:
    - '[[017_cli_commands]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/21'
commits:
  c640eea: 'test(cli): cover template guard error paths'
  abcbd98: 'ci: align codecov upload with centralized coverage output'
  f56a08f: 'fix(cli): address PR #21 review feedback'
  663a39a: 'fix(ci): set NX_PARALLEL=1 in pre-push hook to avoid coverage merge race'
  54fd671: 'test(cli): exclude direct execution bootstrap from coverage'
  6526369: 'docs(backlog): mark WI-032 ready-for-review with test evidence'
  0e47673: 'fix(cli): resolve latest PR #21 review feedback'
  ea4773e: 'ci: serialize nx affected tests in GitHub Actions'
test_results:
  - timestamp: 2026-03-04T10:45:00.000Z
    note: |
      WI-032 local validation:
      - runTests: src/packages/cli/test/config.test.ts -> 26 passed, 0 failed
      - runTests: full CLI suite (cli/config/commands) -> 47 passed, 0 failed
      - pre-commit hooks passed during commit
  - timestamp: 2026-03-04T18:45:00.000Z
    note: 'Validation complete for WI-032. `pnpm nx test @templjs/cli --coverage` passed (54 tests, 95.56% statements/lines).'
  - timestamp: 2026-03-04T18:51:23.000Z
    note: 'PR #21 merged to main with all required checks passing (Analyze, Build, Install Dependencies, Lint, Lint Work Item Frontmatter, Test, Type Check).'
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

- [x] `.templjs.json` config file parsed correctly
- [x] Config file located (current dir, then parent dirs up to root)
- [x] CLI flags override config file settings
- [x] All core commands respect config (render, validate, init)
- [x] Config validation (JSON schema)
- [x] Error handling for invalid config
- [x] Clear error messages for missing config
- [x] Documentation on config file format
- [x] 8+ tests passing

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

- [x] Design config file schema
- [x] Implement config file discovery (.templjs.json search)
- [x] Parse config file (JSON)
- [x] Merge config with CLI flags (flags take precedence)
- [x] Apply config to all commands
- [x] Validate config against schema
- [x] Error handling for missing/invalid config
- [x] Document config format
- [x] Write tests (8+ tests)

## Related Items

- WI-017: Core CLI commands (completed)
- WI-033: Schema parity across formats
- WI-018: Watch mode

## Implementation Notes

- Use same delimiter structure as @templjs/core for consistency
- Support environment variable substitution in config? (TBD)
- Consider cascade from project root to monorepo root (for Nx workspaces)

## Implementation Progress (2026-03-04)

Implemented `.templjs.json` configuration support for CLI commands with schema validation and parent-directory discovery.

- Added config module in `src/packages/cli/src/config/`:
  - `types.ts`: typed CLI config interfaces
  - `schema.ts`: JSON schema for config validation
  - `loader.ts`: discovery, parsing, validation, merge, and option-application helpers
  - `index.ts`: module exports
- Integrated config loading in `src/packages/cli/src/cli.ts` for `render`, `validate`, and `init` commands.
- Added `src/packages/cli/test/config.test.ts` with 22 tests covering discovery, validation, overrides, and option application.
