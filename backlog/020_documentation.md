---
id: wi-020
type: work-item
subtype: task
lifecycle: draft
title: '20: Write Documentation (Getting Started and API Reference)'
status: proposed
priority: critical
estimated: 14
assignee: ''
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
    - '[[006_chevrotain_parser]]'
    - '[[007_ast_renderer]]'
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

- [ ] Create `docs/getting-started.md` (5-minute setup, hello world example)
- [ ] Create `docs/api-reference.md` (auto-generated from JSDoc + manual sections)
- [ ] Create comprehensive function reference:
  - [ ] `docs/functions/string-functions.md` - All 19 string functions with examples
  - [ ] `docs/functions/number-functions.md` - All 15 number functions with examples
  - [ ] `docs/functions/datetime-functions.md` - All 12 datetime functions with examples
  - [ ] `docs/functions/array-functions.md` - All 16 array functions with examples
  - [ ] `docs/functions/object-functions.md` - All 9 object functions with examples
- [ ] Create `docs/query-language.md` (dot notation, array access, filters, chaining)
- [ ] Create `docs/cli.md` (render, validate, init, watch commands)
- [ ] Create `docs/configuration.md` (delimiters, schema, custom functions)
- [ ] Create `docs/examples.md` (10+ example templates)
- [ ] Update root `README.md` with feature overview and badges
- [ ] Add TypeScript JSDoc comments to all source files
- [ ] Generate API docs from source (TypeDoc)
- [ ] Setup docs hosting (GitHub Pages or Vercel)
- [ ] Create function cheat sheet (one-page reference)
- [ ] Add visual diagrams for query language and control flow

## Deliverables

- Complete user documentation (getting started, tutorials, guides)
- Comprehensive API reference for all 50+ built-in functions
- CLI command reference with examples
- 10+ annotated example templates
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
- [ ] String functions (19): Complete documentation with examples
- [ ] Number functions (15): Complete documentation with examples
- [ ] Datetime functions (12): Complete documentation with examples
- [ ] Array functions (16): Complete documentation with examples
- [ ] Object functions (9): Complete documentation with examples
- [ ] CLI docs list all commands with output examples
- [ ] Examples cover: strings, numbers, arrays, objects, control flow
- [ ] All links and code examples tested
- [ ] Docs render properly (markdown, HTML, PDF)
- [ ] Function cheat sheet fits one page
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
