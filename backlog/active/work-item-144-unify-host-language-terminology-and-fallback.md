---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:144-unify-host-language-terminology-and-fallback
title: '144: Unify Host Language Terminology and Fallback'
summary: Align host-language union and fallback naming across core and language-core
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 6
actual: 0
assignee: copilot
---

## Goal

Eliminate host-language fallback drift and enforce one host-language contract across packages.

## Execution Dependencies

- Depends on `work-item:143-unify-semantic-zone-vocabulary-metadata-content-template`.

## Scope

- Align host-language unions and fallback behavior.
- Remove mismatched fallback terms in dependent consumers.

## File-by-File Rename Checklist

- [ ] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - `SemanticHostLanguage` fallback value `unknown` -> `plaintext`
- [ ] [src/packages/language-core/src/public-types.ts](src/packages/language-core/src/public-types.ts)
  - enforce host-language union parity with core
- [ ] [src/packages/volar/src/diagnostic-template-analysis.ts](src/packages/volar/src/diagnostic-template-analysis.ts)
  - host-language branch `unknown` -> `plaintext`

## Tasks

- [ ] Rename fallback term in core.
- [ ] Update volar fallback branch logic.
- [ ] Enforce language-core and core union parity in tests.
- [ ] Remove any remaining `unknown` fallback usage in touched area.

## Deliverables

- One host-language fallback term in stack contracts.
- No fallback drift at consumer boundaries.

## Acceptance Criteria

- [ ] Host-language unions match exactly in core and language-core.
- [ ] Volar branch logic uses canonical fallback.
- [ ] Tests pass for fallback behavior.

## Testing Strategy

- Run core semantic context tests.
- Run language-core contract tests.
- Run volar diagnostics tests that exercise host-language zoning.
