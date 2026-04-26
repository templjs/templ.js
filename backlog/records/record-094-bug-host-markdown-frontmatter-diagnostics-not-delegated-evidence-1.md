---
$schema: schemas/work-management/frontmatter/record.json
id: record:094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-1
title: '094: host markdown/frontmatter diagnostics delegation evidence 1'
summary: server diagnostics now publish templjs and host markdown diagnostics together
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-23T00:00:00.000Z

## Outcome

partial

## Observation

Implemented host diagnostics delegation in `src/extensions/vscode/src/server.ts` by calling
`languageService.doValidation(uri)` and merging its result with templjs diagnostics on every
diagnostics publish cycle for opened, changed, and watched documents.

Added unit test in `src/extensions/vscode/test/server.test.ts`:

- `publishes templjs and host markdown diagnostics together on save`

This test mocks `doValidation` to return a synthetic `markdown` diagnostic. It validates
**delegation wiring** only — that `doValidation` is called and its result is merged into
`sendDiagnostics`. It does **not** exercise the actual YAML frontmatter parse path inside
`createTempljsMarkdownDiagnosticsPlugin.provideDiagnostics`.

**Correction:** An earlier version of this record overstated frontmatter coverage. This evidence
captures only the server-side merge wiring. The real markdown frontmatter validation landed in the
markdown-specific Volar diagnostics plugin and is captured in evidence-2.

## Subject References

- [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/test/server.test.ts`
