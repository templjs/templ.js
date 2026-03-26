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
---

## Goal

Replace string-priority expression parsing with a token-driven structured parser that builds expression AST directly from grammar constructs.

## Scope

- Build parser pipeline for unary/binary/ternary/grouping/filter/function constructs using token stream semantics.
- Remove or quarantine legacy string-splitting heuristics after behavior parity is reached.
- Preserve current public behavior for templjs syntax during transition.

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
