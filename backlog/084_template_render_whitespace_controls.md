---
id: wi-084
type: work-item
subtype: story
lifecycle: draft
title: '084: Implement Template Render Whitespace Controls'
status: proposed
priority: medium
estimated: 5
actual: 5
assignee: ''
commits:
  78e0adf: 'feat(core): add whitespace controls and fixture parity (WI-084)'
test_results:
  - timestamp: 2026-03-29T00:00:00Z
    note: |
      Implemented whitespace trim controls for expression/statement delimiters in core lexer/parser/render flow.
      Added regression coverage for default + custom delimiters and render behavior.
      Validation:
      - `pnpm --filter @templjs/core test -- test/lexer/lexer.test.ts test/parser/parser.test.ts test/renderer/renderer.integration.test.ts src/parser/parser.extract-content.test.ts`
      - Result: 4 files passed, 788 tests passed, 1 skipped
  - timestamp: 2026-03-29T00:00:00Z
    note: |
      Added malformed-syntax and backward-compatibility coverage for trim markers.
      Validation:
      - `pnpm --filter @templjs/core test -- test/lexer/lexer.test.ts test/renderer/renderer.integration.test.ts src/parser/parser.extract-content.test.ts`
      - Result: 3 files passed, 416 tests passed, 1 skipped
  - timestamp: 2026-04-02T00:00:00Z
    note: |
      Completed template adoption across examples, benchmark fixtures, and VS Code fixture templates.
      Follow-up compatibility work restored successful fixture rendering for key/value object loops,
      trusted raw HTML output via `no_escape`, and ternary expression evaluation used by deploy fixtures.
      Validation:
      - `pnpm --filter @templjs/core build`
      - `pnpm --filter @templjs/cli build`
      - `node src/packages/cli/dist/cli.js render -t benchmarks/fixtures/vscode-workspace/backlog/benchmark-fixture.md.templ -i /tmp/templ_fixture_data.json`
      - `node src/packages/cli/dist/cli.js render -t src/extensions/vscode/test-fixtures/config.json.tmpl -i /tmp/templ_fixture_data.json`
      - `node src/packages/cli/dist/cli.js render -t src/extensions/vscode/test-fixtures/deploy.yaml.tmpl -i /tmp/templ_fixture_data.json`
      - `node src/packages/cli/dist/cli.js render -t src/extensions/vscode/test-fixtures/example.md.tmpl -i /tmp/templ_fixture_data.json`
      - `node src/packages/cli/dist/cli.js render -t src/extensions/vscode/test-fixtures/index.html.tmpl -i /tmp/templ_fixture_data.json`
      - Result: fixtures-ok
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

- WI-084 depends on [[062_authoritative_template_parsing_and_delimiter_parity]] and [[067_extract_authoritative_core_statement_and_expression_analysis]], which are currently `proposed`; lifecycle transition beyond `proposed` is deferred until dependency statuses are reconciled.

## References

- [docs/prd/v1.0-requirements.md](../docs/prd/v1.0-requirements.md)
- [src/packages/core/src/lexer](../src/packages/core/src/lexer)
- [src/packages/core/src/parser](../src/packages/core/src/parser)
- [src/packages/core/src/renderer](../src/packages/core/src/renderer)
- [src/extensions/vscode/test-fixtures](../src/extensions/vscode/test-fixtures)

Tracking note: fixture adoption and follow-up compatibility validation completed on 2026-04-02.
Lifecycle note: status remains `proposed` until dependencies [[062_authoritative_template_parsing_and_delimiter_parity]] and [[067_extract_authoritative_core_statement_and_expression_analysis]] advance.
