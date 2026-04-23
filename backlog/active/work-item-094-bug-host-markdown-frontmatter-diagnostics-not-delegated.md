---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:094-bug-host-markdown-frontmatter-diagnostics-not-delegated
title: '094: Host markdown/frontmatter diagnostics are not delegated for tmpl files'
summary: Host markdown/frontmatter diagnostics are missing for tmpl files even when file-watch notifications fire
type: work-item
subtype: bug
lifecycle: active
status: ready-for-review
priority: high
estimated: 3
actual: 1
links:
  evidence:
    - '[[record-094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-1]]'
---

## Goal

Enable host markdown/frontmatter diagnostics for `.md.tmpl`/`.md.templ`/`.md.tpl` files by delegating diagnostics through the Volar host-language pipeline.

## Bug Summary

After correcting `watchFileExtensions` ordering, save events now trigger templjs diagnostics, but host markdown/frontmatter diagnostics still do not appear. This indicates file-watch routing is no longer the blocker; the remaining issue is missing host-language diagnostics delegation.

## Reproduction Steps

1. Launch Extension Development Host.
2. Open a `.md.tmpl` file with a markdown/frontmatter issue.
3. Save the file.
4. Observe diagnostics.

## Expected Behavior

Diagnostics from host markdown/frontmatter tooling appear alongside templjs diagnostics after save.

## Actual Behavior

Only templjs diagnostics are reported; host markdown/frontmatter diagnostics are absent.

## Suspected Root Cause

`src/extensions/vscode/src/server.ts` diagnostics publishing path uses templjs `collectDiagnostics(...)` only and does not delegate host-language diagnostics.

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
