---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:039-cli-validate-schema-error-messaging
title: '39: Fix CLI Validate Schema Error Messaging'
summary: Fix CLI Validate Schema Error Messaging
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: obsolete
priority: medium
estimated: 2
actual: 0
commits:
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
  2172d3d: 'test(cli): align schema warning test with non-blocking behavior'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-039-cli-validate-schema-error-messaging-evidence-1]]'
---

## Goal

Provide clear, actionable error messages when users attempt schema validation before it's implemented, instead of reporting "Template has errors" for syntactically valid templates.

## Background

PR 23 unresolved comments:

- `validateCommand()` forces `valid: false` when `schemaPath` is provided and appends warnings to `errors` array
- CLI validate action throws `Error('Template has errors...')` which is misleading when template is syntactically valid
- Real issue is "schema validation not supported yet", not a template error

## Tasks

- [ ] Separate "template syntax validity" from "schema validation not supported"
- [ ] Keep `valid` reflecting syntax validation, add separate `schemaWarning`/`warnings` field OR
- [ ] Throw explicit "schema validation not supported" error when `--schema` provided
- [ ] Update CLI validate action to distinguish schema limitations from template errors
- [ ] Add test cases for schema flag behavior

## Acceptance Criteria

- [ ] Syntactically valid templates with `--schema` don't report as "has errors"
- [ ] Clear error message explains schema validation not yet implemented
- [ ] Exit codes remain correct (0 for valid syntax, non-zero for unsupported feature)
- [ ] All validate command tests pass

## Notes

References:

- [PR 23 comment on validate.ts](https://github.com/templjs/templ.js/pull/23#discussion_r2901368199)
- [PR 23 comment on cli.ts](https://github.com/templjs/templ.js/pull/23#discussion_r2901368204)

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
