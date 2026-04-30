---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:094-bug-host-markdown-frontmatter-diagnostics-not-delegated
title: '094: Host markdown/frontmatter diagnostics are not delegated for tmpl files'
summary: Host markdown/frontmatter diagnostics are missing for tmpl files even when file-watch notifications fire
type: work-item
subtype: bug
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 3
actual: 1
completed_date: '2026-04-30'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/64
  evidence:
    - '[[record-094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-1]]'
    - '[[record-094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-2]]'
---

## Goal

Enable host markdown/frontmatter diagnostics for `.md.tmpl`/`.md.templ`/`.md.tpl` files by delegating diagnostics through the Volar host-language pipeline. Specifically:

1. **Link diagnostics** — broken links and fragment references via `vscode-markdown-languageservice`, surfaced through `LanguageService.doValidation()`.
2. **YAML frontmatter parse errors** — invalid YAML in `---` frontmatter blocks, detected by `gray-matter` in `createMarkdownPlugin.provideDiagnostics`.
3. **Heading style violations** (e.g. `#Bad heading`) — NOT covered; `vscode-markdown-languageservice` is a link-checker only. A separate WI is needed if markdownlint integration is desired.

## Bug Summary

After correcting `watchFileExtensions` ordering (WI-092) and registering host service plugins (WI-093), save events trigger templjs diagnostics. However, host markdown/frontmatter diagnostics still did not appear because:

1. `collectHostDiagnosticsForDocument` used an unsafe defensive cast that obscured the direct `doValidation` call, and
2. `vscode-markdown-languageservice.computeDiagnostics` only validates link references — it cannot detect YAML frontmatter errors. A dedicated `gray-matter` parse step was missing from `createMarkdownPlugin.provideDiagnostics`.

## Reproduction Steps

1. Launch Extension Development Host.
2. Open a `.md.tmpl` file with invalid YAML frontmatter (e.g. `---\ntitle: {\n---`).
3. Save the file.
4. Observe diagnostics.

## Expected Behavior

- YAML frontmatter parse errors appear in the Problems panel as `markdown` source diagnostics.
- Broken link diagnostics appear for files with broken markdown links.
- templjs variable/schema diagnostics appear alongside.

## Actual Behavior (before fix)

Only templjs diagnostics were reported; host markdown/frontmatter diagnostics were absent.

## Root Cause

Two issues:

1. `collectHostDiagnosticsForDocument` in `server.ts` used an overly defensive cast `(languageService as { doValidation?: ... })?.doValidation` — unnecessarily obscuring a direct `doValidation` call.
2. `createMarkdownPlugin.provideDiagnostics` in `service-plugins.ts` only called `vscode-markdown-languageservice.computeDiagnostics` (link-checker only) — no YAML frontmatter validation existed.

## Tasks

- [x] Trace diagnostics pipeline from document save to `publishDiagnosticsForDocument`
- [x] Verify host-language service plugin registration for diagnostics path
- [x] Implement host diagnostics delegation for markdown/frontmatter documents
- [x] Add integration coverage validating markdown/frontmatter diagnostics in `.md.tmpl`
- [x] Confirm no regression in templjs diagnostics

## Acceptance Criteria

- [x] Save on `.md.tmpl` triggers templjs and host markdown/frontmatter diagnostics
- [x] Diagnostics appear in Problems panel for host markdown/frontmatter violations
- [x] Existing templjs diagnostics behavior remains unchanged
- [x] Relevant integration tests pass

## Relationships

- `relates_to`: [[work-item-092-bug-watchfileextensions-reversed-order]]
- `relates_to`: [[work-item-093-bug-no-host-language-service-plugins]]
