---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:053-validate-schema-input-integration
title: '053: Wire `validate` command to schema + input validation'
summary: Wire `validate` command to schema + input validation
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 3
actual: 2
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/27
  evidence:
    - '[[record-053-validate-schema-input-integration-evidence-1]]'
---

## Goal

Make `templjs validate` perform real schema-backed input validation (not just template syntax checks), as an incremental step toward reverse workflows and extraction.

## Background

`validate` previously accepted `--schema` but only returned a warning that schema integration was not wired. This created a CLI/API gap compared to `render` format support and blocked incremental validation use cases.

This work item tracks wiring now completed in CLI:

- Template syntax validation remains in place
- Schema parsing/compilation now runs when `--schema` is provided
- Input parsing + schema validation now runs when `--schema` + `--input` are both provided

## Scope

- `templjs validate --template <path>`: syntax-only validation
- `templjs validate --template <path> --schema <path>`: syntax + schema load/compile validation
- `templjs validate --template <path> --schema <path> --input <path>`: syntax + schema + input-data validation

## Tasks

- [x] Wire `validateCommand(template, schema, input)` signature and behavior
- [x] Integrate `SchemaValidator` into CLI validate command path
- [x] Reuse format parsing (`parseDataAsync`) for schema and input files
- [x] Add CLI flag `-i, --input <path>` for validate
- [x] Return actionable error when `--input` is used without `--schema`
- [x] Update command-level unit tests
- [x] Update CLI integration tests
- [x] Verify test pass status

## Acceptance Criteria

- [x] No schema placeholder warning remains in validate flow
- [x] `validate` supports schema + input validation with existing parser stack
- [x] Validation failures include schema error details in command errors
- [x] Existing validate syntax behavior remains intact
- [x] Updated tests pass (41/41)

## Implementation Notes

- Validation now executes in `src/packages/cli/src/commands/validate.ts`
- CLI option/wiring added in `src/packages/cli/src/cli.ts`
- Tests updated in:
  - `src/packages/cli/test/commands/validate.test.ts`
  - `src/packages/cli/test/cli.test.ts`

## Follow-ups

- Add stdin support for `validate --input -`
- Add input format override parity for validate (`--input-format`) if needed
- Consider surfacing structured schema diagnostics in JSON output mode

## Relationships

- `depends_on`: [[work-item-033-schema-parity]]
