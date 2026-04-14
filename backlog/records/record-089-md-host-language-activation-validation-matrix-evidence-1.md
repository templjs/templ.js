---
$schema: schemas/work-management/frontmatter/record.json
id: record:089-md-host-language-activation-validation-matrix-evidence-1
title: '089: Validate host-language activation for templated Markdown extensions evidence 1'
summary: '089: Validate host-language activation for templated Markdown extensions evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.769Z

## Outcome

noted

## Observation

Host-language activation matrix validation completed for `.md.templ`, `.md.tmpl`, and `.md.tpl`.
Added regression coverage in VS Code extension and Volar tests to enforce deterministic behavior.
Validation runs:

- `pnpm --filter vscode-templjs test -- test/extension.test.ts test/server-inprocess.integration.test.ts` (28 passed)
- `pnpm --filter @templjs/volar test -- test/index.test.ts` (55 passed)

## Subject References

- [[work-item-089-md-host-language-activation-validation-matrix]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
