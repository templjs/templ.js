---
id: wi-022
type: work-item
subtype: task
lifecycle: draft
title: '22: Release v1.0 to npm and VS Code Marketplace'
status: proposed
priority: critical
estimated: 10
assignee: ''
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
    - '[[006_chevrotain_parser]]'
    - '[[007_ast_renderer]]'
    - '[[008_query_engine]]'
    - '[[009_lexer_tests]]'
    - '[[010_parser_tests]]'
    - '[[011_renderer_tests]]'
    - '[[012_volar_plugin]]'
    - '[[013_syntax_highlighting]]'
    - '[[014_diagnostics]]'
    - '[[015_intellisense]]'
    - '[[016_extension_tests]]'
    - '[[017_cli_commands]]'
    - '[[018_cli_watch_mode]]'
    - '[[019_cli_tests]]'
    - '[[020_documentation]]'
    - '[[021_examples_demo]]'
    - '[[025_schema_validation]]'
    - '[[026_cicd_scaffolding_artifact]]'
    - '[[027_virtual_code_mapping]]'
    - '[[028_textmate_grammar]]'
    - '[[029_cli_signal_handling]]'
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

- [ ] Bump version to 1.0.0 in all `package.json` files
- [ ] Update CHANGELOG.md with all changes
- [ ] Create GitHub release with release notes
- [ ] Publish packages to npm: `@templjs/core`, `@templjs/cli`, `@templjs/volar`
- [ ] Publish VS Code extension to marketplace
- [ ] Verify package installations work
- [ ] Write release announcement blog post
- [ ] Share on social media (Twitter, Reddit, HN)
- [ ] Update website/landing page
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

- [ ] All tests passing (100% required)
- [ ] All ADRs and documentation complete
- [ ] No open critical issues
- [ ] Performance benchmarks meet targets
- [ ] Security scanning passed (CodeQL)

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

- [ ] Update README with install instructions
- [ ] Update CHANGELOG with v1.0 summary
- [ ] Add v1.0 release notes
- [ ] Update website homepage
- [ ] Update quick start guide with version pin

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

- Requires: [[20 Write Documentation]], [[21 Create Examples and Demo]]
- Marks completion of Phase 5
