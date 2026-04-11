---
id: changelog-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Changelog
---

## Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [0.1.0] - 2026-04-10

### Added

- Published initial beta package surface for `@templjs/core`, `@templjs/cli`, and `@templjs/volar`.
- Added comprehensive documentation set:
  - Getting Started
  - API and CLI references
  - Query language and configuration guides
  - Function catalog and cheat sheet
- Added examples and demo coverage for Markdown, HTML, JSON, config, and documentation templates.

### Changed

- Hardened docs site content for GitHub Pages/Jekyll by escaping Liquid-sensitive examples.
- Added docs landing page so docs root resolves correctly on Pages.
- Added CI docs API guard to ensure TypeDoc output stays generated and committed.

### Quality

- Release branch checks passing across lint, type-check, build, benchmark, and multi-platform test matrix.

[0.1.0]: https://github.com/templjs/templ.js/releases/tag/v0.1.0
