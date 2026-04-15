---
id: wi-022
type: work-item
subtype: task
lifecycle: active
title: '22: Release v0.1.0 to npm and VS Code Marketplace'
status: in-progress
priority: critical
estimated: 10
actual: 9
assignee: ''
test_results:
  - timestamp: 2026-03-22T00:00:00Z
    note: |
      Release gate preparation started:
      - Advanced WI-040, WI-054, WI-055 implementation and verification
      - Delivered reduced WI-020/WI-021 documentation + example slice needed for release docs path
      Remaining blockers before publish:
      - Dependency work items must be moved to closed state with merged PR evidence
      - Release credentials and publication steps require maintainer execution (`npm publish`, `vsce publish`)
  - timestamp: 2026-04-10T00:00:00Z
    note: |
      Dependencies resolved and release prep resumed:
      - WI-020 (Write Documentation) closed: GitHub Pages live at https://templjs.github.io/templ.js/
      - WI-021 (Examples and Demo) closed: PR #46 merged, all examples validated
      All pre-release documentation and example deliverables are complete.
      Remaining steps require maintainer credentials: npm publish, vsce publish.
  - timestamp: 2026-04-10T00:00:00Z
    note: |
      Executed remaining repository-controlled release tasks:
      - Set monorepo/package versions to 0.1.0 via WI-022 versioning strategy (pre-1.0 release transition; changeset pre-release exit path would produce 1.0.0, so 0.1.0 was set as the intentional first-publish baseline)
      - Added `CHANGELOG.md` v0.1.0 summary
      - Added release docs:
        - `docs/release-notes-v0.1.0.md`
        - `docs/how-to/v0.1.0-release-announcement.md`
      - Updated docs landing and README install instructions for v0.1.0
      - Created GitHub draft release: https://github.com/templjs/templ.js/releases/tag/v0.1.0
      Validation and release-gate checks:
      - `pnpm run lint:frontmatter` passed
      - `pnpm lint:markdown` passed
      - PR #47 checks all successful (lint, type-check, build, benchmark, test matrix, docs API guard)
      - `gh issue list --label critical --state open` returned no open critical issues
      Credential blockers (still pending):
      - `npm whoami` -> 401 Unauthorized (cannot publish npm packages in this environment)
      - VS Code Marketplace publish requires maintainer PAT for `vsce publish`
  - timestamp: 2026-04-11T00:00:00Z
    note: |
      Completed Groups 1-3 critical-path execution follow-up:
      - Group 1 cleanup complete: synced to `main`, removed merged local branch `chore/close-wi020-wi022-final-gaps`, removed stale worktree `prod-plan-critical-path`
      - Group 2 archival prep complete: moved closed WI-020, WI-021, WI-024 into `backlog/archive/`
      - Group 3 versioning workflow complete via Changesets (no manual package edits):
        - `pnpm changeset pre enter beta`
        - `pnpm changeset add --empty` (twice; fixed package set)
        - `pnpm changeset version` (twice) -> all fixed packages now at `0.1.0`
      Validation:
      - `pnpm run lint:frontmatter` passed
  - timestamp: 2026-04-11T06:46:00Z
    note: |
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
  - timestamp: 2026-04-11T06:52:00Z
    note: |
      Retried VS Code Marketplace publish flow:
      - `npx --yes @vscode/vsce package --no-dependencies --skip-license` succeeded and produced `vscode-templjs-0.1.0.vsix`
      - `npx --yes @vscode/vsce publish 0.1.0 --pat <token> --skip-license` failed with monorepo dependency scan noise when publishing from source tree
      Required path to publish pre-release extension:
      - Use a normal semver extension version (now `0.1.0`)
      - Publish with `--pre-release` flag
      Additional packaging hygiene:
      - Added `src/extensions/vscode/LICENSE` so packaging no longer requires `--skip-license` for missing-license prompt
  - timestamp: 2026-04-11T07:05:00Z
    note: |
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
  - timestamp: 2026-04-11T07:32:00Z
    note: |
      Published the VS Code extension as a Marketplace pre-release using the packaged VSIX flow:
      - `npx --yes @vscode/vsce package --no-dependencies --pre-release` succeeded with `vscode-templjs-0.1.0.vsix`
      - `npx --yes @vscode/vsce publish --pre-release --packagePath vscode-templjs-0.1.0.vsix` succeeded
      - VSCE reported publish target: `templjs.vscode-templjs v0.1.0`
      Follow-up verification:
      - Immediate `curl` to the public Marketplace URL still returned `404`; likely propagation delay, so install/public visibility verification remains open until the listing resolves publicly.
  - timestamp: 2026-04-11T08:00:00Z
    note: |
      Added repository release automation aligned to the corrected publish strategy:
      - `release.yml` now maintains the Changesets version PR on pushes to `main`
      - Tagged releases now publish from commits already on `main`
      - `pre-vX.Y.Z` tags publish npm packages to dist-tag `next`, publish the VS Code extension as prerelease, and create a prerelease GitHub Release
      - `vX.Y.Z` tags publish npm packages to dist-tag `latest`, publish the VS Code extension as stable, and create a stable GitHub Release
      - VS Code publishing now packages a VSIX with `--no-dependencies` and publishes from `--packagePath` to avoid monorepo dependency-scan failures
      Documentation updates:
      - Updated `.github/workflows/README.md` to document the tag model
      - Updated `.github/SECRETS.md` to document required secrets and publisher membership requirements
links:
  depends_on:
    - '[[020_documentation]]'
    - '[[021_examples_demo]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/31'
    - 'https://github.com/templjs/templ.js/pull/47'
    - 'https://github.com/templjs/templ.js/pull/48'
---

## Goal

Publish templ.js v0.1.0 to npm and VS Code Marketplace with announcement.

Note: The `022_release_v1.md` filename is retained for work-item continuity from the original v1 planning phase; the authoritative target version for this work item is v0.1.0 in frontmatter/title and task content.

## Background

The v0.1.0 release establishes the first public pre-1.0 distribution and opens early-adoption feedback collection. Includes:

- npm package publishing
- VS Code extension publishing
- Release announcement blog post
- GitHub release with changelog
- Social media promotion

## Tasks

- [x] Bump version to 0.1.0 in all `package.json` files
- [x] Update CHANGELOG.md with all changes
- [x] Create GitHub release with release notes
- [ ] Publish packages to npm: `@templjs/core`, `@templjs/cli`, `@templjs/volar`
- [x] Publish VS Code extension to marketplace
- [ ] Verify package installations work
- [x] Write release announcement blog post
- [ ] Share on social media (Twitter, Reddit, HN)
- [x] Update website/landing page
- [ ] Monitor for issues and feedback

## Deliverables

- Published npm packages
- Published VS Code extension
- GitHub release
- Announcement blog post
- Social media posts
- Updated landing page

## Acceptance Criteria

- [ ] `npm install @templjs/core` works
- [ ] `npm install @templjs/cli` works
- [ ] VS Code extension installable from marketplace
- [ ] GitHub release visible
- [ ] Blog post published
- [ ] Social media posts made
- [ ] At least 100 package downloads in first week

## Release Checklist

### Pre-Release

- [x] All tests passing (100% required)
- [x] All ADRs and documentation complete
- [x] No open critical issues
- [x] Performance benchmarks meet targets
- [x] Security scanning passed (CodeQL)

### npm Publishing

```bash
# Login to npm
npm login
# Publish packages
npm publish packages/core
npm publish packages/cli
npm publish packages/volar
```

### VS Code Extension

```bash
# Package extension
cd extensions/vscode
vsce package
# Publish
vsce publish
```

### Documentation Updates

- [x] Update README with install instructions
- [x] Update CHANGELOG with v0.1.0 summary
- [x] Add v0.1.0 release notes
- [x] Update website homepage
- [x] Update quick start guide with version pin

### Announcement Content

- **Blog Post Title**: "templ.js v0.1.0: TypeScript Meta-Templating System"
- **Key Points**:
  - Ground-up TypeScript rewrite
  - Full IDE support via Volar
  - 800+ tests, 95% coverage
  - <5ms parse time, <100KB bundle
  - Ready for production use
- **Links**:
  - GitHub: <https://github.com/templjs/templ.js>
  - npm: <https://npmjs.com/package/@templjs/core>
  - VS Code Extension: <https://marketplace.visualstudio.com/items?itemName=templjs.vscode-templjs>
  - Docs: <https://templjs.dev>

### Social Media Posts

- **Twitter**: "🎉 templ.js v0.1.0 is live! Introducing a TypeScript meta-templating system with full IDE support, <5ms parsing, and 95% test coverage. Get started: npm i @templjs/core → [link]"
- **Reddit**: Post to r/typescript, r/vscode, r/javascript
- **Hacker News**: Submit to front page

## Post-Release Monitoring

- Monitor GitHub issues for bugs
- Track npm download metrics
- Gather user feedback
- Fix critical bugs within 24 hours
- Plan v0.2.0 improvements

## References

- [npm Publishing Guide](https://docs.npmjs.com/publishing-packages-packages-to-the-registry)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Release Notes Template](https://keepachangelog.com/)

## Dependencies

- Immediate dependencies: [[020_documentation]], [[021_examples_demo]]
- Marks completion of Phase 5

## Remaining External Actions

- npm package publication requires maintainer npm credentials (`npm whoami` currently returns 401 in this environment)
- VS Code Marketplace publish succeeded; public listing/install verification is pending Marketplace propagation
- Future publish automation no longer requires a dedicated prerelease branch; tags created from `main` control prerelease vs stable channels
- Post-publication verification (`npm install ...`), social promotion, and week-1 download KPI tracking occur after publish
