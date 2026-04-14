---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:043-volar-delimiter-type-validation
title: '43: Add Type Validation for Delimiter Values in Volar'
summary: Add Type Validation for Delimiter Values in Volar
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: obsolete
priority: medium
estimated: 2
actual: 0
commits:
  ce96fda: 'fix(pr-23): address latest Copilot and CodeRabbit review threads'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-043-volar-delimiter-type-validation-evidence-1]]'
---

## Goal

Explicitly validate that delimiter values are non-empty strings in `resolveDelimiters()`, preventing confusing runtime errors.

## Background

PR 23 unresolved comment: `resolveDelimiters()` currently assumes delimiter values are strings and can throw opaque `TypeError` later when non-string values are passed. Since this is now part of the public Volar API surface, it should validate inputs up front.

## Tasks

- [ ] Add type validation before length/overlap checks in `resolveDelimiters()`
- [ ] Throw clear error message including field name when non-string detected
- [ ] Add test cases for invalid delimiter types (undefined, null, numbers, objects)
- [ ] Update error messages to be consistent across all validation paths

## Acceptance Criteria

- [ ] Non-string delimiter values throw clear error: `"resolveDelimiters: {key} must be a non-empty string"`
- [ ] All delimiter validation tests pass
- [ ] No `TypeError` thrown from downstream `startsWith()` calls
- [ ] Documentation updated with validation behavior

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901437336)

Location: `src/packages/volar/src/template-delimiters.ts` around line 60

Suggested fix validates `typeof value !== 'string'` before length check.

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
