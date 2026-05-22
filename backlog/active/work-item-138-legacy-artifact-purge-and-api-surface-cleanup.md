---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:138-legacy-artifact-purge-and-api-surface-cleanup
title: '138: Legacy Artifact Purge and API Surface Cleanup'
summary: Remove all Semantify migration artifacts, compatibility shims, and obsolete tests/docs after projection-backed feature cutover.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: legacy-api-removal-underway
priority: critical
estimated: 8
actual: 3
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/173
  evidence:
    - '[[record-20260521-221758-138-legacy-artifact-purge-and-api-surface-cleanup]]'
---

## Goal

Delete all transition and legacy compatibility artifacts so Semantify and dependent packages expose projection-only semantic architecture.

## Background

Cutover quality requires explicit removal, not just deprecation. Mixed-path artifacts create long-term ambiguity, maintenance drag, and hidden fallback behavior.

## Scope

- Remove Semantify compatibility APIs and exports.
- Remove migration fallback code and outdated tests.
- Update docs to final-state projection architecture language.

## Tasks

- [x] Remove legacy compatibility APIs from Semantify source and public exports.
- [x] Remove compatibility fallback code paths in Volar/language-service.
- [x] Remove tests that validate legacy behavior contracts.
- [x] Update README/ADR/docs to final-state projection-only architecture guidance.
- [ ] Run full repo validation after removal and resolve breakages.

## Deliverables

- Projection-only API surface and source tree.
- Updated docs with no migration/transition framing.
- Cleaned tests aligned to final architecture.

## Progress Notes

- 2026-05-22: Removed Semantify compatibility API surface (`createSemantifyServices`, `SemantifyServices`) from public exports and deleted legacy binder compatibility implementation.
- 2026-05-22: Removed obsolete Semantify framework compatibility tests and validated package/build/frontmatter checks for this cleanup slice.
- 2026-05-22: Removed Volar schema-kind compatibility remapping so projected semantic kinds (`templjs.schema-path`, `templjs.schema-enum-value`) flow directly through snapshot/query paths and tests.
- 2026-05-22: Updated `docs/templjs-volar-target-architecture.md` to final-state guidance (removed staged migration/transitional runbook sections) and validated docs/frontmatter lint.

## Acceptance Criteria

- [ ] No source/test/doc reference remains for legacy Semantify compatibility APIs.
- [ ] Public Semantify exports are projection/profile contract focused.
- [ ] Build, type-check, and tests pass with legacy paths removed.

## Relationships

- `depends_on`: [[work-item-137-language-service-server-capability-wiring-finalization]]

## Validation

```bash
pnpm run type-check
pnpm run test
pnpm run build
```
