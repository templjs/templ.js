---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:042-cli-test-xml-override-coverage
title: '42: Add Test Coverage for Explicit XML Input Format Override'
summary: Add Test Coverage for Explicit XML Input Format Override
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implemented
priority: low
estimated: 1
actual: 1
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/94
---

## Goal

Add test coverage for the `inputFormat: 'xml'` explicit override path in render command.

## Background

PR 23 unresolved comment: The XML test case currently uses `renderCommand('template.templ', 'data.xml')` which only exercises extension-based detection, leaving the explicit override branch untested.

## Tasks

- [x] Update XML test to explicitly pass `inputFormat: 'xml'` option
- [x] Verify override works with non-.xml extension files
- [x] Add similar coverage for other format overrides (YAML, TOML, JSON) if missing
- [x] Ensure test assertions remain accurate

## Acceptance Criteria

- [x] Test exercises `renderCommand('template.templ', 'data.xml', { inputFormat: 'xml' })`
- [x] Explicit format override path has test coverage
- [x] All render command tests pass
- [x] Coverage metrics improved for format detection logic

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901437335)

Location: `src/packages/cli/test/commands/render.test.ts` around line 121

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
