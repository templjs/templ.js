---
id: wi-020
type: work-item
subtype: task
lifecycle: active
title: '20: Write Documentation (Getting Started and API Reference)'
status: in-progress
priority: critical
estimated: 14
actual: 6
assignee: ''
commits:
  8418c57: 'docs(release): add critical-path docs and reduced example slice (WI-020, WI-021, WI-022)'
  660e0f6: 'docs: address PR-38 function reference review comments'
  51333ce: 'docs: add WI-020 query and configuration guides (#39)'
test_results:
  - timestamp: 2026-03-22T00:00:00Z
    note: |
      Delivered release-critical documentation slice:
      - Added `docs/getting-started.md`
      - Added `docs/api-reference.md`
      - Added `docs/cli.md`
      - Added `docs/examples.md` (reduced WI-021-backed example set)
      Validation:
      - `pnpm run lint:frontmatter` passed after docs additions
  - timestamp: 2026-03-27T17:35:00Z
    note: |
      Added function-reference documentation slice for WI-020:
      - Added `docs/functions/string-functions.md`
      - Added `docs/functions/number-functions.md`
      - Added `docs/functions/datetime-functions.md`
      - Added `docs/functions/array-functions.md`
      - Added `docs/functions/object-functions.md`
      - Linked function references from `docs/api-reference.md`
      Validation:
      - `pnpm run lint:frontmatter`
      - `pnpm lint:markdown`
  - timestamp: 2026-03-28T19:55:00Z
    note: |
      Added guide-level documentation for remaining core CLI authoring paths:
      - Added `docs/query-language.md` covering dot notation, array access, quoted keys, filters, and runtime limits
      - Added `docs/configuration.md` covering `.templjs.json` discovery, schema fields, CLI precedence, and env expansion
      - Updated root `README.md` with direct documentation entry points
      Validation:
      - `pnpm lint:markdown`
      - `pnpm run lint:frontmatter`
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
    - '[[006_chevrotain_parser]]'
    - '[[007_ast_renderer]]'
    - '[[029_cli_signal_handling]]'
    - '[[032_cli_config_files]]'
    - '[[033_schema_parity]]'
---

## Goal

Create comprehensive user and developer documentation.

## Background

Documentation covers:

- Getting started guide (5-minute setup)
- API reference for programmers
- CLI reference for command-line users
- Configuration guide
- Examples and tutorials

## Tasks

- [x] Create `docs/getting-started.md` (5-minute setup, hello world example)
- [x] Create `docs/api-reference.md` (auto-generated from JSDoc + manual sections)
- [x] Create comprehensive function reference:
  - [x] `docs/functions/string-functions.md` - String function catalog with usage examples
  - [x] `docs/functions/number-functions.md` - Number function catalog with usage examples
  - [x] `docs/functions/datetime-functions.md` - Datetime function catalog with usage examples
  - [x] `docs/functions/array-functions.md` - Array function catalog with usage examples
  - [x] `docs/functions/object-functions.md` - Object function catalog with usage examples
- [x] Create `docs/query-language.md` (dot notation, array access, filters, chaining)
- [x] Create `docs/cli.md` (render, validate, init, watch commands)
- [x] Create `docs/configuration.md` (delimiters, schema, custom functions)
- [ ] Create `docs/examples.md` (10+ example templates)
- [x] Update root `README.md` with feature overview and badges
- [ ] Add TypeScript JSDoc comments to all source files
- [x] Generate API docs from source (TypeDoc)
- [x] Add TypeDoc regression guard in CI (`ci:docs-api` must succeed and produce `docs/api/index.html`)
- [ ] Setup docs hosting (GitHub Pages or Vercel)
- [x] Create function cheat sheet (one-page reference)
- [x] Add visual diagrams for query language and control flow
- [ ] Track and close remaining TypeDoc documentation coverage gap via [[090_typedoc_coverage_ratcheting]]

## Deliverables

- Complete user documentation (getting started, tutorials, guides)
- Comprehensive API reference for all 50+ built-in functions
- CLI command reference with examples
- Curated annotated example templates (release-critical slice delivered)
- Function cheat sheet (single-page quick reference)
- JSDoc comments in all source code
- Auto-generated TypeDoc HTML API documentation
- Live docs website with search

## Acceptance Criteria

- [ ] Getting started guide is runnable in <5 minutes
- [ ] All 50+ built-in functions documented with:
  - [ ] Function signature and parameter types
  - [ ] 3+ usage examples per function
  - [ ] Edge cases and common errors
  - [ ] Performance considerations where relevant
- [x] String functions: Complete documentation with examples
- [x] Number functions: Complete documentation with examples
- [x] Datetime functions: Complete documentation with examples
- [x] Array functions: Complete documentation with examples
- [x] Object functions: Complete documentation with examples
- [ ] CLI docs list all commands with output examples
- [ ] Examples cover: strings, numbers, arrays, objects, control flow
- [ ] All links and code examples tested
- [ ] Docs render properly (markdown, HTML, PDF)
- [x] TypeDoc docs generation succeeds in CI and emits `docs/api/index.html`
- [x] Function cheat sheet fits one page
- [ ] Search functionality works

## Documentation Structure

```bash ascii-tree
docs/
├── README.md              # Overview
├── getting-started.md     # 5-minute quickstart
├── api-reference.md       # Core library API
├── cli.md                 # CLI commands
├── configuration.md       # Config options
├── examples.md            # Feature examples
└── adr/                   # Architecture decisions
```

## Getting Started Outline

1. Installation: `npm install @templjs/core`
2. First render: Parse + render example
3. IDE setup: VS Code extension install
4. CLI usage: `templjs render`
5. Next steps: Links to examples/API docs

## References

- [Write the Docs Style Guide](https://www.writethedocs.org/)
- [API Documentation Best Practices](https://developers.google.com/style)

## Dependencies

- Requires: [[11 Renderer Tests]] (core complete), [[16 Extension Tests]] (extension complete), [[19 CLI Tests]] (CLI complete)

## Related Items

- [[061_multiple_filter_signatures]]: follow-up API/docs work for overload-aware built-in filter signature metadata
- [[090_typedoc_coverage_ratcheting]]: incremental path to close TypeDoc/JSDoc coverage gap after generation guard baseline
