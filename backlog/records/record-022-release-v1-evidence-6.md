---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-6
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 6'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 6'
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

Retried VS Code Marketplace publish flow:

- `npx --yes @vscode/vsce package --no-dependencies --skip-license` succeeded and produced `vscode-templjs-0.1.0.vsix`
- `npx --yes @vscode/vsce publish 0.1.0 --pat <token> --skip-license` failed with monorepo dependency scan noise when publishing from source tree
  Required path to publish pre-release extension:
- Use a normal semver extension version (now `0.1.0`)
- Publish with `--pre-release` flag
  Additional packaging hygiene:
- Added `src/extensions/vscode/LICENSE` so packaging no longer requires `--skip-license` for missing-license prompt

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
