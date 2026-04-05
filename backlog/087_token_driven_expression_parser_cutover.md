---
id: wi-087
type: work-item
subtype: story
lifecycle: draft
title: '087: Implement Token-Driven Expression Parser Cutover'
status: proposed
priority: high
estimated: 10
actual: 0
assignee: ''
links:
  depends_on:
    - '[[085_structured_expression_parser_ast_migration_epic]]'
    - '[[086_expression_ast_contract_and_semantic_ir]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/42'
---

## Goal

Replace string-priority expression parsing with a token-driven structured parser that builds expression AST directly from grammar constructs.

## Scope

- Build parser pipeline for unary/binary/ternary/grouping/filter/function constructs using token stream semantics.
- Remove or quarantine legacy string-splitting heuristics after behavior parity is reached.
- Preserve current public behavior for templjs syntax during transition.

## Current Compatibility Context

- Runtime ternary evaluation was added in core renderer follow-up work to restore fixture/render parity for existing templates.
- `for key, value in object` support and `no_escape` filter support were also added as compatibility fixes during template adoption.
- WI-087 remains open because expression parsing still relies on legacy string-priority heuristics; this work item owns the parser-stage cutover, not those runtime parity patches.
- Compatibility reference: `78e0adf` added the current renderer-side ternary parity path without performing the token-driven parser cutover.

## Tasks

- [ ] Implement structured parse functions for precedence layers and grouping.
- [ ] Add compatibility tests for current templates and known parser edge-cases.
- [ ] Run side-by-side parser parity checks during migration window.
- [ ] Remove deprecated heuristic branches after parity signoff.

## Acceptance Criteria

- [ ] Parenthesized, chained, and mixed-precedence expressions are resolved by token-driven parser stages.
- [ ] Legacy recursion/heuristic failure modes have dedicated regression tests.
- [ ] Existing parser tests pass with equivalent or improved diagnostics.
- [ ] Coverage thresholds remain satisfied for parser modules.

## References

- [src/packages/core/src/parser/parser.ts](../src/packages/core/src/parser/parser.ts)
- [src/packages/core/src/renderer/evaluators.ts](../src/packages/core/src/renderer/evaluators.ts)
