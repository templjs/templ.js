---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:020-documentation
title: '20: Write Documentation (Getting Started and API Reference)'
summary: Write Documentation (Getting Started and API Reference)
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 14
actual: 12
completed_date: '2026-04-10'
commits:
  8418c57: 'docs(release): add critical-path docs and reduced example slice (WI-020, WI-021, WI-022)'
  660e0f6: 'docs: address PR-38 function reference review comments'
  51333ce: 'docs: add WI-020 query and configuration guides (#39)'
  d0b2689: 'fix(docs): escape Liquid template syntax in ADR-002 for Jekyll build'
  7f5f809: 'fix(docs): escape Liquid in ADR-006 integration example'
  7b69481: 'fix(docs): harden markdown examples against Jekyll Liquid parsing'
  2c56484: 'docs: add docs site index landing page'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/43
  evidence:
    - '[[record-020-documentation-evidence-1]]'
    - '[[record-020-documentation-evidence-2]]'
    - '[[record-020-documentation-evidence-3]]'
    - '[[record-020-documentation-evidence-4]]'
    - '[[record-020-documentation-evidence-5]]'
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
- [x] Create `docs/examples.md` (10+ example templates)
- [x] Update root `README.md` with feature overview and badges
- [x] Add TypeScript JSDoc comments to all source files (coverage ratchet tracked via [[work-item-090-typedoc-coverage-ratcheting]])
- [x] Generate API docs from source (TypeDoc)
- [x] Add TypeDoc regression guard in CI (`ci:docs-api` must succeed and produce `docs/api/index.html`)
- [x] Setup docs hosting (GitHub Pages or Vercel)
- [x] Create function cheat sheet (one-page reference)
- [x] Add visual diagrams for query language and control flow
- [x] Track remaining TypeDoc documentation coverage gap via [[work-item-090-typedoc-coverage-ratcheting]]

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

- [x] Getting started guide is runnable in <5 minutes
- [ ] All 50+ built-in functions documented with (full depth deferred to follow-up items):
  - [ ] Function signature and parameter types
  - [ ] 3+ usage examples per function
  - [ ] Edge cases and common errors
  - [ ] Performance considerations where relevant
- [x] String functions: Complete documentation with examples
- [x] Number functions: Complete documentation with examples
- [x] Datetime functions: Complete documentation with examples
- [x] Array functions: Complete documentation with examples
- [x] Object functions: Complete documentation with examples
- [x] CLI docs list all commands with output examples
- [x] Examples cover: strings, numbers, arrays, objects, control flow
- [x] All links and code examples tested (render-validated; GitHub Pages deployment confirmed)
- [x] Docs render properly (markdown/HTML via GitHub Pages; PDF publishing out of v1.0 scope)
- [x] TypeDoc docs generation succeeds in CI and emits `docs/api/index.html`
- [x] Function cheat sheet fits one page
- [x] Site navigation works on GitHub Pages (full-text search deferred to v1.1)

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

- [[work-item-061-multiple-filter-signatures]]: follow-up API/docs work for overload-aware built-in filter signature metadata
- [[work-item-090-typedoc-coverage-ratcheting]]: incremental path to close TypeDoc/JSDoc coverage gap after generation guard baseline

## Relationships

- `depends_on`: [[work-item-005-chevrotain-lexer]]
- `depends_on`: [[work-item-006-chevrotain-parser]]
- `depends_on`: [[work-item-007-ast-renderer]]
- `depends_on`: [[work-item-029-cli-signal-handling]]
- `depends_on`: [[work-item-032-cli-config-files]]
- `depends_on`: [[work-item-033-schema-parity]]
