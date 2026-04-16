---
$schema: schemas/work-management/frontmatter/record.json
id: record:055-bug-no-md-lang-server-support-evidence-1
title: '055: Markdown syntax highlighting and linting not working for md.tpl files evidence 1'
summary: '055: Markdown syntax highlighting and linting not working for md.tpl files evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.760Z

## Outcome

noted

## Observation

Follow-up parity fix and verification:

- Added `.tpl.*` variants to language server watched template extension list
- Updated extension README extension coverage and configuration notes
- Validation runs:
  - `src/extensions/vscode/test/server.test.ts` (41 passed)
  - `src/extensions/vscode/test/server-inprocess.integration.test.ts` (5 passed)
  - Full VS Code extension test set (80 passed)

## Subject References

- [[work-item-055-bug-no-md-lang-server-support]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
