---
id: wi-084
type: work-item
subtype: story
lifecycle: draft
title: '084: Implement Template Render Whitespace Controls'
status: proposed
priority: medium
estimated: 5
actual: 0
assignee: ''
links:
  depends_on:
    - '[[062_authoritative_template_parsing_and_delimiter_parity]]'
    - '[[067_extract_authoritative_core_statement_and_expression_analysis]]'
---

## Goal

Add first-class whitespace control semantics to templjs rendering so template authors can suppress or preserve surrounding whitespace around template delimiters without restructuring templates for formatting.

## Background

Current rendering behavior preserves literal whitespace around statements and expressions. This is predictable, but it forces templates to be manually compressed when users want clean JSON/Markdown/HTML output without extra blank lines. The PRD explicitly calls out whitespace control syntax, but there is no active work item tracking implementation in core parser/renderer.

## Scope

- Define supported whitespace control syntax for expression and statement delimiters.
- Parse and represent whitespace trim intent in AST/token metadata.
- Apply trim behavior during render output assembly.
- Preserve backward compatibility for templates that do not use trim controls.

## Tasks

- [ ] Confirm and document the syntax contract from PRD for left/right/both-side trimming.
- [ ] Extend lexer/parser to capture whitespace-trim directives on delimiters.
- [ ] Update renderer output assembly to apply trim semantics safely around adjacent text nodes.
- [ ] Add unit tests for lexer/parser trim syntax detection.
- [ ] Add renderer integration tests covering JSON, Markdown, and HTML templates with trim controls.
- [ ] Add negative tests for malformed trim syntax and backward-compatibility tests for existing templates.
- [ ] Update user-facing docs with examples and migration guidance.

## Acceptance Criteria

- [ ] Templates can trim left whitespace, right whitespace, or both around supported delimiters.
- [ ] Existing templates without trim controls render exactly as before.
- [ ] Mixed content templates (text + statements + expressions) produce deterministic output with trim controls.
- [ ] Rendered JSON/Markdown examples can avoid formatting-only blank lines without structural template rewrites.
- [ ] Parser and renderer test suites include explicit trim-control regression coverage.
- [ ] Documentation includes syntax reference and at least one end-to-end example per output format.

## References

- [docs/prd/v1.0-requirements.md](../docs/prd/v1.0-requirements.md)
- [src/packages/core/src/lexer](../src/packages/core/src/lexer)
- [src/packages/core/src/parser](../src/packages/core/src/parser)
- [src/packages/core/src/renderer](../src/packages/core/src/renderer)
