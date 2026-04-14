---
$schema: schemas/work-management/frontmatter/record.json
id: record:054-bug-no-schema-aware-authoring-evidence-5
title: '054: VS Code extension does not load input schema for schema-aware authoring evidence 5'
summary: '054: VS Code extension does not load input schema for schema-aware authoring evidence 5'
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

Checklist reconciliation verification:

- Ran `src/extensions/vscode/test/server-inprocess.integration.test.ts` (5 passed)
- Ran `src/packages/volar/test/diagnostic-provider.test.ts` + `src/packages/volar/test/intellisense-provider.test.ts` (121 passed)
- Verified schema-aware frontmatter/content completions and diagnostics, glob/precedence resolution,
  root schema alias extraction, URL schema loading, and backward compatibility for `templjs.schemaPath`

## Subject References

- [[work-item-054-bug-no-schema-aware-authoring]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/32>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
