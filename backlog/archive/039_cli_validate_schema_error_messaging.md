---
id: wi-039
type: work-item
subtype: task
lifecycle: active
title: '39: Fix CLI Validate Schema Error Messaging'
status: closed
status_reason: obsolete
priority: medium
estimated: 2
actual: 0
assignee: ''
start_date: 2026-03-08
end_date: 2026-03-08
commits:
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
  2172d3d: 'test(cli): align schema warning test with non-blocking behavior'
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
notes:
  - timestamp: 2026-03-08T00:00:00Z
    note: |
      WI-039 already fixed in PR #23 commits 8900fcc and 2172d3d:
      - Schema validation now returns schemaWarning field instead of forcing failure
      - validate.ts returns { valid: result.valid, schemaWarning: '...' }
      - Test coverage: src/packages/cli/test/commands/validate.test.ts
      - Test verifies schemaWarning message appears without forcing valid: false
      - All validate tests pass (4/4 passing)
      - Change implemented in src/packages/cli/src/commands/validate.ts
      - NOTE: Work item created in error - issue was already fixed when WI-039 was written
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
