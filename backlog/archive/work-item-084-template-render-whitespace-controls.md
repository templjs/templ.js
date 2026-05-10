---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:084-template-render-whitespace-controls
title: '084: Implement Template Render Whitespace Controls'
summary: Implement Template Render Whitespace Controls
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 5
actual: 5
completed_date: '2026-05-10'
commits:
  78e0adf: 'feat(core): add whitespace controls and fixture parity (WI-084)'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/42
    - https://github.com/templjs/templ.js/pull/43
  evidence:
    - '[[record-084-template-render-whitespace-controls-evidence-1]]'
    - '[[record-084-template-render-whitespace-controls-evidence-2]]'
    - '[[record-084-template-render-whitespace-controls-evidence-3]]'
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

- [x] Confirm and document the syntax contract from PRD for left/right/both-side trimming.
- [x] Extend lexer/parser to capture whitespace-trim directives on delimiters.
- [x] Update renderer output assembly to apply trim semantics safely around adjacent text nodes.
- [x] Add unit tests for lexer/parser trim syntax detection.
- [x] Add renderer integration tests covering JSON, Markdown, and HTML templates with trim controls.
- [x] Add negative tests for malformed trim syntax and backward-compatibility tests for existing templates.
- [x] Update user-facing docs with examples and migration guidance.

## Acceptance Criteria

- [x] Templates can trim left whitespace, right whitespace, or both around supported delimiters.
- [x] Existing templates without trim controls render exactly as before.
- [x] Mixed content templates (text + statements + expressions) produce deterministic output with trim controls.
- [x] Rendered JSON/Markdown examples can avoid formatting-only blank lines without structural template rewrites.
- [x] Parser and renderer test suites include explicit trim-control regression coverage.
- [x] Documentation includes syntax reference and at least one end-to-end example per output format.

## Blockers

- WI-084 depends on [[work-item-062-authoritative-template-parsing-and-delimiter-parity]] and [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]], which are currently `proposed`; lifecycle transition beyond `proposed` is deferred until dependency statuses are reconciled.

## References

- [docs/prd/v1.0-requirements.md](../docs/prd/v1.0-requirements.md)
- [src/packages/core/src/lexer](../src/packages/core/src/lexer)
- [src/packages/core/src/parser](../src/packages/core/src/parser)
- [src/packages/core/src/renderer](../src/packages/core/src/renderer)
- [src/extensions/vscode/test-fixtures](../src/extensions/vscode/test-fixtures)

Tracking note: fixture adoption and follow-up compatibility validation completed on 2026-04-02.
Lifecycle note: status remains `proposed` until dependencies [[work-item-062-authoritative-template-parsing-and-delimiter-parity]] and [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]] advance.

## Relationships

- `depends_on`: [[work-item-062-authoritative-template-parsing-and-delimiter-parity]]
- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
