---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:143-unify-semantic-zone-vocabulary-metadata-content-template
title: '143: Unify Semantic Zone Vocabulary to Metadata Content Template'
summary: Standardize semantic zone terminology across core, language-core, semantify adapters, and volar
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 10
actual: 0
assignee: copilot
---

## Goal

Use one semantic zone vocabulary everywhere with values `metadata`, `content`, and `template`, and remove conflicting section and zone naming drift.

## Scope

- Standardize zone-kind values to `metadata`, `content`, and `template`.
- Remove alternate terms that represent the same concept in neighboring layers.
- Keep names and values format-agnostic.

## File-by-File Rename Checklist

- [ ] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - `SemanticContextBlock` -> `SemanticZoneSegment`
  - `SemanticZoneKind` values `metadata` and `body` -> `metadata` and `content`
  - `legacyContextBlock` -> `segment`
- [ ] [src/packages/language-core/src/public-types.ts](src/packages/language-core/src/public-types.ts)
  - `TempljsSemanticZoneRef.contextBlock` -> `TempljsSemanticZoneRef.segment`
  - `TempljsSemanticZoneRef.kind` values `frontmatter` and `content` and `template` -> `metadata` and `content` and `template`
- [ ] [src/packages/volar/src/diagnostic-template-analysis.ts](src/packages/volar/src/diagnostic-template-analysis.ts)
  - semantic zone gates aligned to `metadata` and `content`
- [ ] [src/packages/volar/src/semantify-projection-adapter.ts](src/packages/volar/src/semantify-projection-adapter.ts)
  - schema adapter option `contextBlock` -> `zoneSegment`
  - values `frontmatter` and `content` -> `metadata` and `content`

## Tasks

- [ ] Rename core zone and segment symbols.
- [ ] Rename language-core zone reference symbols and values.
- [ ] Update volar consumers and adapters.
- [ ] Update tests and fixtures to match `metadata` and `content` and `template` values.
- [ ] Remove retired zone vocabulary tokens.

## Deliverables

- One semantic zone vocabulary across core and language layers.
- Updated tests enforcing `metadata` and `content` and `template`.

## Acceptance Criteria

- [ ] No `frontmatter` or `body` legacy zone values remain in touched contracts.
- [ ] All touched layer contracts use `metadata` and `content` and `template` values.
- [ ] Tests pass with updated zone value assertions.

## Testing Strategy

- Run core semantic context tests.
- Run language-core contract boundary tests.
- Run volar diagnostics and adapter tests.
