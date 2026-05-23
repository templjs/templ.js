---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:144-unify-host-language-terminology-and-fallback
title: '144: Unify Host Language Terminology and Fallback'
summary: Align host-language union and fallback naming across core and language-core
assignee: copilot
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 6
actual: 1
completed_date: '2026-05-23'
commits:
  54f5eb345909b6a5dda12c50ee2a9ae7f4263c9f: 'feat: normalize host-language fallback to plaintext (WI-144)'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/183
  evidence:
    - '[[record-20260523-044941-144-unify-host-language-terminology-and-fallback]]'
---

## Goal

Eliminate host-language fallback drift and enforce one host-language contract across packages.

## Execution Dependencies

- Depends on `work-item:143-unify-semantic-zone-vocabulary-metadata-content-template`.

## Scope

- Align host-language unions and fallback behavior.
- Remove mismatched fallback terms in dependent consumers.

## File-by-File Rename Checklist

- [x] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - `SemanticHostLanguage` fallback value `unknown` -> `plaintext`
- [x] [src/packages/language-core/src/public-types.ts](src/packages/language-core/src/public-types.ts)
  - enforce host-language union parity with core
- [x] [src/packages/volar/src/diagnostic-template-analysis.ts](src/packages/volar/src/diagnostic-template-analysis.ts)
  - host-language branch `unknown` -> `plaintext`

## Tasks

- [x] Rename fallback term in core.
- [x] Update volar fallback branch logic.
- [x] Enforce language-core and core union parity in tests.
- [x] Remove any remaining `unknown` fallback usage in touched area.

## Deliverables

- One host-language fallback term in stack contracts.
- No fallback drift at consumer boundaries.

## Acceptance Criteria

- [x] Host-language unions match exactly in core and language-core.
- [x] Volar branch logic uses canonical fallback.
- [x] Tests pass for fallback behavior.

## Testing Strategy

- Run core semantic context tests.
- Run language-core contract tests.
- Run volar diagnostics tests that exercise host-language zoning.
