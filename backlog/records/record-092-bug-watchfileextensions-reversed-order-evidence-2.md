---
$schema: schemas/work-management/frontmatter/record.json
id: record:092-bug-watchfileextensions-reversed-order-evidence-2
title: '092: watchFileExtensions fix verified, host diagnostics gap persists'
summary: manual smoke test confirms file-watch path matches, but host markdown/frontmatter diagnostics still do not appear
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-23T00:00:00.000Z

## Outcome

failed

## Observation

Manual smoke validation was performed in Extension Development Host after the watch extension fix:

1. Opened `.md.tmpl` document
2. Edited and saved file
3. Observed diagnostics behavior

Result:

- Templjs diagnostics are reported on save
- Host markdown/frontmatter diagnostics are not reported

This confirms the `watchFileExtensions` correction is not sufficient to provide host-language diagnostics. The remaining gap aligns with [[work-item-093-bug-no-host-language-service-plugins]] and [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]] (missing Volar host-language service plugin delegation and host diagnostics delegation).

## Subject References

- [[work-item-092-bug-watchfileextensions-reversed-order]]
- [[work-item-093-bug-no-host-language-service-plugins]]
- [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/test/server.test.ts`
- `src/extensions/vscode/test/server-inprocess.integration.test.ts`
