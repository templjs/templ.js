---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:088-multi-grammar-expression-overlay-support
title: '088: Add Multi-Grammar Expression Overlay Support'
summary: Add Multi-Grammar Expression Overlay Support
type: work-item
subtype: story
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 8
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-088-multi-grammar-expression-overlay-support]]'
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

## Relationships

- `depends_on`: [[work-item-085-structured-expression-parser-ast-migration-epic]]
- `depends_on`: [[work-item-086-expression-ast-contract-and-semantic-ir]]
- `depends_on`: [[work-item-087-token-driven-expression-parser-cutover]]
