---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-3
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 3'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 3'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.680Z

## Outcome

noted

## Observation

Executed remaining repository-controlled release tasks:

- Bumped monorepo/package versions to 0.1.0 (`package.json`, core/cli/volar/context-graph, VS Code extension)
- Added `CHANGELOG.md` v0.1.0 summary
- Added release docs:
  - `docs/release-notes-v0.1.0.md`
  - `docs/how-to/v0.1.0-release-announcement.md`
- Updated docs landing and README install instructions for v0.1.0
- Created GitHub draft release: <https://github.com/templjs/templ.js/releases/tag/v0.1.0>
  Validation and release-gate checks:
- `pnpm run lint:frontmatter` passed
- `pnpm lint:markdown` passed
- PR #47 checks all successful (lint, type-check, build, benchmark, test matrix, docs API guard)
- `gh issue list --label critical --state open` returned no open critical issues
  Credential blockers (still pending):
- `npm whoami` -> 401 Unauthorized (cannot publish npm packages in this environment)
- VS Code Marketplace publish requires maintainer PAT for `vsce publish`

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
