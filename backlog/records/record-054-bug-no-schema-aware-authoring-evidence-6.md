---
$schema: schemas/work-management/frontmatter/record.json
id: record:054-bug-no-schema-aware-authoring-evidence-6
title: '054: VS Code extension does not load input schema for schema-aware authoring evidence 6'
summary: '054: VS Code extension does not load input schema for schema-aware authoring evidence 6'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.758Z

## Outcome

noted

## Observation

Schema hot-reload + documentation follow-up:

- Added server-side watched-file handler to invalidate schema cache and republish diagnostics
  for open documents when schema-like files (`.json`, `.yaml`, `.yml`) change on disk
- Expanded watched template extension coverage for `.tpl.*` variants in server options
- Updated VS Code extension README with schema configuration, precedence, and hot-reload behavior
- Verification:
  - `src/extensions/vscode/test/server.test.ts` (41 passed)
  - `src/extensions/vscode/test/server-inprocess.integration.test.ts` (5 passed)
  - Full VS Code extension test set (80 passed)

## Subject References

- [[work-item-054-bug-no-schema-aware-authoring]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/32>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
