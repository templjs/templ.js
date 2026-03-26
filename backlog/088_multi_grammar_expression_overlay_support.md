---
id: wi-088
type: work-item
subtype: story
lifecycle: draft
title: '088: Add Multi-Grammar Expression Overlay Support'
status: proposed
priority: medium
estimated: 8
actual: 0
assignee: ''
links:
  depends_on:
    - '[[085_structured_expression_parser_ast_migration_epic]]'
    - '[[086_expression_ast_contract_and_semantic_ir]]'
    - '[[087_token_driven_expression_parser_cutover]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/32'
---

## Goal

Enable concurrent grammar overlays (templjs, Handlebars-like, Jinja2-like) that map to shared expression AST semantics while preserving dialect-specific syntax affordances.

## Scope

- Add dialect adapter layer that translates frontend grammar constructs into canonical expression AST.
- Ensure evaluator and semantic tooling operate on shared AST semantics instead of grammar-specific logic.
- Add compatibility matrix tests across dialect overlays.

## Tasks

- [ ] Define dialect adapter interface and registration points.
- [ ] Implement at least one non-templjs overlay prototype mapped to shared AST.
- [ ] Add parser/evaluator integration tests proving shared business logic across overlays.
- [ ] Document extension strategy for additional grammars.

## Acceptance Criteria

- [ ] Multiple grammar overlays can parse expressions into the same canonical AST contract.
- [ ] Evaluator behavior is shared and consistent across overlays for equivalent semantics.
- [ ] Dialect-specific syntax differences are isolated to adapters, not evaluator core.
- [ ] Overlay tests cover precedence, grouping, filters/helpers, and diagnostics parity.
