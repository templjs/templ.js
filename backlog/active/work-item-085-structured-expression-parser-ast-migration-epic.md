---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:085-structured-expression-parser-ast-migration-epic
title: '085: Structured Expression Parser AST Migration Epic'
summary: Structured Expression Parser AST Migration Epic
type: work-item
subtype: epic
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 24
actual: 0
---

## Goal

Migrate templjs expression parsing from string-heuristic dispatch to a fully structured, token-driven parser so expression business logic is represented and resolved at the AST layer.

## Background

Current expression parsing uses priority-based string matching and helper heuristics. This is functional but makes precedence edge-cases harder to reason about, increases parser-specific business logic outside AST nodes, and blocks clean concurrent support for multiple templating grammars sharing a common semantic core.

## Scope

- Introduce an AST-first expression parsing architecture with explicit precedence and grouping semantics.
- Remove expression-specific string heuristics where AST-level modeling can replace them.
- Enable grammar overlays (Handlebars, Jinja2, etc.) to map into a common expression AST contract.

## Tasks

- [ ] Define target architecture and migration phases for token-driven expression parsing.
- [ ] Introduce shared AST contracts for dialect-agnostic expression semantics.
- [ ] Implement parser cutover slices with behavior parity gates.
- [ ] Add regression and compatibility tests for existing templjs syntax.
- [ ] Add overlay strategy for multiple grammar frontends over shared AST semantics.

## Acceptance Criteria

- [ ] Expression precedence and grouping are resolved by structured parser logic, not ad hoc string heuristics.
- [ ] Expression business logic is represented in AST nodes and evaluated from AST semantics.
- [ ] Existing templjs templates remain behavior-compatible through migration.
- [ ] Architecture supports concurrent grammar overlays without duplicating evaluator logic.
- [ ] Parser and renderer test coverage remains at or above package thresholds.

## Relationships

- `depends_on`: [[work-item-062-authoritative-template-parsing-and-delimiter-parity]]
- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
