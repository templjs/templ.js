---
$schema: schemas/work-management/frontmatter/record.json
id: record:054-bug-no-schema-aware-authoring-evidence-2
title: '054: VS Code extension does not load input schema for schema-aware authoring evidence 2'
summary: '054: VS Code extension does not load input schema for schema-aware authoring evidence 2'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.757Z

## Outcome

noted

## Observation

Phase 2 slice implemented:

- Added settings `templjs.contentSchemaPath` and glob-based `templjs.schemas`
- Added HTTP/HTTPS schema loading support with timeout handling
- Added per-document schema precedence resolver (inline > root > setting, independent per schema type)
- Added root property extraction for `$templ-schema` and `$content-schema`
- Added active document context handoff from extension to server
- Extended plugin options with `contentSchema` and `contentSchemaUri`
- Added tests for precedence and glob-pattern resolution
- Targeted tests: 23 passed, 0 failed

## Subject References

- [[work-item-054-bug-no-schema-aware-authoring]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/32>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
