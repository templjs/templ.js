---
id: wi-086
type: work-item
subtype: task
lifecycle: draft
title: '086: Define Expression AST Contract and Semantic IR'
status: proposed
priority: high
estimated: 6
actual: 0
assignee: ''
links:
  depends_on:
    - '[[085_structured_expression_parser_ast_migration_epic]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/32'
---

## Goal

Define a stable expression AST contract and semantic intermediate representation that all supported grammar frontends can target.

## Scope

- Enumerate required expression node kinds, operator precedence tiers, and grouping behavior.
- Define normalization rules for dialect-specific syntax aliases into common AST semantics.
- Specify validation invariants and error-node behavior at AST boundaries.

## Tasks

- [ ] Document canonical expression node taxonomy and metadata requirements.
- [ ] Define operator/precedence table and associativity in AST terms.
- [ ] Define dialect mapping rules (templjs, Handlebars-style helpers, Jinja2-style tests/operators).
- [ ] Add schema/type tests that enforce AST contract invariants.

## Acceptance Criteria

- [ ] AST contract is explicit, versioned in code, and referenced by parser/evaluator tests.
- [ ] Operator precedence and grouping rules are unambiguous and test-backed.
- [ ] Dialect mapping rules identify what is normalized vs retained as dialect-specific metadata.
