---
$schema: schemas/work-management/frontmatter/record.json
id: record:020-documentation-evidence-3
title: '20: Write Documentation (Getting Started and API Reference) evidence 3'
summary: '20: Write Documentation (Getting Started and API Reference) evidence 3'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.732Z

## Outcome

noted

## Observation

Added guide-level documentation for remaining core CLI authoring paths:

- Added `docs/query-language.md` covering dot notation, array access, quoted keys, filters, and runtime limits
- Added `docs/configuration.md` covering `.templjs.json` discovery, schema fields, CLI precedence, and env expansion
- Updated root `README.md` with direct documentation entry points
  Validation:
- `pnpm lint:markdown`
- `pnpm run lint:frontmatter`

## Subject References

- [[work-item-020-documentation]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/43>
