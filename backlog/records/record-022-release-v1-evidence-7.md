---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-7
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 7'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 7'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.681Z

## Outcome

noted

## Observation

Corrected release version strategy to match a public pre-1.0 release:

- Removed stale prerelease Changesets state:
  - deleted `.changeset/pre.json`
  - deleted `.changeset/slick-peas-flash.md`
  - deleted `.changeset/gentle-rivers-press.md`
- Regenerated synchronized package versions at `0.1.0` for `@templjs/core`, `@templjs/cli`, `@templjs/volar`, `@templjs/context-graph`, and `vscode-templjs`
- Updated package changelogs, top-level changelog, docs index, release notes, and announcement content to reference `0.1.0`
  Validation:
- `pnpm run lint:frontmatter` passed
- `pnpm lint:markdown` passed

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
