---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:007-ast-renderer
title: '7: Implement AST Renderer/Interpreter'
summary: Implement AST Renderer/Interpreter
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 12
actual: 12
commits:
  9b976b1: 'fix(core): correct expression precedence and evaluator dispatch'
  ccfdbe3: 'refactor(core): extract expression parsers with quote-aware operator splitting'
  f4e879a: 'fix(config): update vitest configs to discover test/**/*.test.ts files'
  913ee9b: 'test(core): add 8 edge case tests to improve parser coverage'
  a9aeb34: 'docs: add comprehensive JSDoc to expression parser module'
  dbb1eca: Initial renderer implementation
  28e78c4: 'docs(backlog): mark WI-007 reconciliation complete in tracking plan'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/2
  evidence:
    - '[[record-007-ast-renderer-evidence-1]]'
    - '[[record-007-ast-renderer-evidence-2]]'
    - '[[record-007-ast-renderer-evidence-3]]'
    - '[[record-007-ast-renderer-evidence-4]]'
---

## Goal

Build execution engine that traverses AST and produces rendered output.

## Background

Renderer interprets AST nodes in context of data object, handling:

- Variable resolution with dot notation
- Control flow (if/else, loops)
- Filter application
- Scope management for nested contexts
- Error handling with partial output

**Related ADRs**: [[ADR-002 Parser Selection]]

## Tasks

- [x] Create `packages/core/src/renderer.ts` with render function
- [x] Implement variable resolver (dot notation, array access)
- [x] Implement filter system (pipe syntax)
- [x] Implement loop execution (for with scope)
- [x] Implement conditional execution (if/else)
- [x] Add scope management for nested contexts
- [x] Implement error handling (undefined variables, type errors)
- [x] Write 200+ unit tests for renderer
- [x] Verify <20ms rendering for 4KB template with loops

## Deliverables

- AST renderer implementation
- Variable resolution with filters
- Control flow execution
- Error handling mechanism
- Renderer test suite with explicit coverage/performance evidence

## Acceptance Criteria

- [x] Expressions render correctly
- [x] Loops iterate properly
- [x] Conditionals branch correctly
- [x] Filters apply in sequence
- [x] 200+ tests passing with 95%+ coverage
- [x] Rendering <20ms for 100 loop iterations
- [x] Undefined variable errors are clear

## Example Usage

```typescript
const ast = parse('Hello {{ user.name }}!');
const output = render(ast, { user: { name: 'Alice' } });
// output = 'Hello Alice!'
```

## References

- Handlebars rendering: <https://handlebarsjs.com/>
- Chevrotain visitor pattern: <https://chevrotain.io/documentation/next/guide/visitor.html>

## Dependencies

- Requires: [[6 Implement Chevrotain Parser]]
- Unblocks: [[8 Implement Query Engine]], [[11 Write Renderer Tests]]

## Relationships

- `depends_on`: [[work-item-006-chevrotain-parser]]
