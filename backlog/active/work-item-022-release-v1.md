---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:022-release-v1
title: '22: Release v0.1.0 to npm and VS Code Marketplace'
summary: Release v0.1.0 to npm and VS Code Marketplace
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation
priority: critical
estimated: 10
actual: 9
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/31
    - https://github.com/templjs/templ.js/pull/47
    - https://github.com/templjs/templ.js/pull/48
  evidence:
    - '[[record-022-release-v1-evidence-1]]'
    - '[[record-022-release-v1-evidence-2]]'
    - '[[record-022-release-v1-evidence-3]]'
    - '[[record-022-release-v1-evidence-4]]'
    - '[[record-022-release-v1-evidence-5]]'
    - '[[record-022-release-v1-evidence-6]]'
    - '[[record-022-release-v1-evidence-7]]'
    - '[[record-022-release-v1-evidence-8]]'
    - '[[record-022-release-v1-evidence-9]]'
---

## Goal

Publish templ.js v0.1.0 to npm and VS Code Marketplace with announcement.

Note: The `022_release_v1.md` filename is retained for work-item continuity from the original v1 planning phase; the authoritative target version for this work item is v0.1.0 in frontmatter, title, and task content.

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

- Immediate dependencies: [[work-item-020-documentation]], [[work-item-021-examples-demo]]
- Marks completion of Phase 5

## Remaining External Actions

- npm package publication requires maintainer npm credentials (`npm whoami` currently returns 401 in this environment)
- VS Code Marketplace publish succeeded; public listing/install verification is pending Marketplace propagation
- Current release automation uses `staging` for automated prerelease publication and `main` plus stable tags for stable releases
- Post-publication verification (`npm install ...`), social promotion, and week-1 download KPI tracking occur after publish

## Relationships

- `depends_on`: [[work-item-020-documentation]]
- `depends_on`: [[work-item-021-examples-demo]]
