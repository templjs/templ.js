---
$schema: schemas/work-management/frontmatter/record.json
id: record:022-release-v1-evidence-9
title: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 9'
summary: '22: Release v0.1.0 to npm and VS Code Marketplace evidence 9'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.682Z

## Outcome

noted

## Observation

Added repository release automation aligned to the corrected publish strategy:

- `release.yml` now maintains the Changesets version PR on pushes to `main`
- Tagged releases now publish from commits already on `main`
- `pre-vX.Y.Z` tags publish npm packages to dist-tag `next`, publish the VS Code extension as prerelease, and create a prerelease GitHub Release
- `vX.Y.Z` tags publish npm packages to dist-tag `latest`, publish the VS Code extension as stable, and create a stable GitHub Release
- VS Code publishing now packages a VSIX with `--no-dependencies` and publishes from `--packagePath` to avoid monorepo dependency-scan failures
  Documentation updates:
- Updated `.github/workflows/README.md` to document the tag model
- Updated `.github/secrets.md` to document required secrets and publisher membership requirements

## Subject References

- [[work-item-022-release-v1]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/47>
- <https://github.com/templjs/templ.js/pull/48>
