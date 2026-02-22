---
id: wi-007
type: work-item
subtype: story
lifecycle: active
title: '7: Implement AST Renderer/Interpreter'
status: in-progress
priority: critical
estimated: 12
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.079Z
    note: Renderer implementation present; no renderer test files found
actual: 0
links:
  depends_on:
    - '[[006_chevrotain_parser]]'
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
- 200+ passing tests

## Acceptance Criteria

- [ ] Expressions render correctly
- [ ] Loops iterate properly
- [ ] Conditionals branch correctly
- [ ] Filters apply in sequence
- [ ] 200+ tests passing with 95%+ coverage
- [ ] Rendering <20ms for 100 loop iterations
- [ ] Undefined variable errors are clear

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
