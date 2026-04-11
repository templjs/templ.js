---
id: wi-022
type: work-item
subtype: task
lifecycle: active
title: '22: Release v1.0 to npm and VS Code Marketplace'
status: ready
priority: critical
estimated: 10
actual: 5
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
      - Bumped monorepo/package versions to 1.0.0-beta.1 (`package.json`, core/cli/volar/context-graph, VS Code extension)
      - Added `CHANGELOG.md` v1.0.0-beta.1 summary
      - Added release docs:
        - `docs/release-notes-v1.0.0-beta.1.md`
        - `docs/how-to/v1.0.0-beta.1-release-announcement.md`
      - Updated docs landing and README install instructions for v1.0.0-beta.1
      - Created GitHub draft release: https://github.com/templjs/templ.js/releases/tag/v1.0.0-beta.1
      Validation and release-gate checks:
      - `pnpm run lint:frontmatter` passed
      - `pnpm lint:markdown` passed
      - PR #47 checks all successful (lint, type-check, build, benchmark, test matrix, docs API guard)
      - `gh issue list --label critical --state open` returned no open critical issues
      Credential blockers (still pending):
      - `npm whoami` -> 401 Unauthorized (cannot publish npm packages in this environment)
      - VS Code Marketplace publish requires maintainer PAT for `vsce publish`
links:
  depends_on:
    - '[[020_documentation]]'
    - '[[021_examples_demo]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/31'
    - 'https://github.com/templjs/templ.js/pull/47'
---

## Goal

Publish templ.js v1.0 to npm and VS Code Marketplace with announcement.

## Background

v1.0 release marks project completion and opens adoption phase. Includes:

- npm package publishing
- VS Code extension publishing
- Release announcement blog post
- GitHub release with changelog
- Social media promotion

## Tasks

- [x] Bump version to 1.0.0-beta.1 in all `package.json` files
- [x] Update CHANGELOG.md with all changes
- [x] Create GitHub release with release notes
- [ ] Publish packages to npm: `@templjs/core`, `@templjs/cli`, `@templjs/volar`
- [ ] Publish VS Code extension to marketplace
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
- [x] Update CHANGELOG with v1.0 summary
- [x] Add v1.0 release notes
- [x] Update website homepage
- [x] Update quick start guide with version pin

### Announcement Content

- **Blog Post Title**: "templ.js v1.0: TypeScript Meta-Templating System"
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

- **Twitter**: "🎉 templ.js v1.0 is live! Introducing a TypeScript meta-templating system with full IDE support, <5ms parsing, and 95% test coverage. Get started: npm i @templjs/core → [link]"
- **Reddit**: Post to r/typescript, r/vscode, r/javascript
- **Hacker News**: Submit to front page

## Post-Release Monitoring

- Monitor GitHub issues for bugs
- Track npm download metrics
- Gather user feedback
- Fix critical bugs within 24 hours
- Plan v1.1 improvements

## References

- [npm Publishing Guide](https://docs.npmjs.com/publishing-packages-packages-to-the-registry)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Release Notes Template](https://keepachangelog.com/)

## Dependencies

- Immediate dependencies: [[020_documentation]], [[021_examples_demo]]
- Marks completion of Phase 5

## Remaining External Actions

- npm package publication requires maintainer npm credentials (`npm whoami` currently returns 401 in this environment)
- VS Code Marketplace publication requires maintainer PAT (`vsce publish` credentialed step)
- Post-publication verification (`npm install ...`), social promotion, and week-1 download KPI tracking occur after publish
