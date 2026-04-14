---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-5
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 5'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 5'
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

Executed Group 4 credential and publication preflight checks:

- `npm whoami` -> `E401 Unauthorized` (no npm auth in this environment)
- `npx --yes @vscode/vsce --version` -> `3.7.1` (tooling available)
- `npx --yes @vscode/vsce verify-pat templjs` prompted for interactive PAT input (no token configured in session)
  Publication/install verification state:
- `npm view @templjs/core@0.1.0 version` -> `E404 Not Found`
- `npm view @templjs/cli@0.1.0 version` -> `E404 Not Found`
- `npm view @templjs/volar@0.1.0 version` -> `E404 Not Found`
- `npm view @templjs/context-graph@0.1.0 version` -> `E404 Not Found`
  Conclusion:
- Repo-controlled release prep is complete; external publish actions remain blocked on maintainer npm auth and VS Code Marketplace PAT.

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
