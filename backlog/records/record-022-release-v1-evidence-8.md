---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-8
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 8'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 8'
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

Published the VS Code extension as a Marketplace pre-release using the packaged VSIX flow:

- `npx --yes @vscode/vsce package --no-dependencies --pre-release` succeeded with `vscode-templjs-0.1.0.vsix`
- `npx --yes @vscode/vsce publish --pre-release --packagePath vscode-templjs-0.1.0.vsix` succeeded
- VSCE reported publish target: `templjs.vscode-templjs v0.1.0`
  Follow-up verification:
- Immediate `curl` to the public Marketplace URL still returned `404`; likely propagation delay, so install/public visibility verification remains open until the listing resolves publicly.

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
