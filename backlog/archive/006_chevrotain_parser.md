---
id: wi-006
type: work-item
subtype: story
lifecycle: active
title: '6: Implement Chevrotain Parser (AST Generation)'
status: closed
status_reason: completed
priority: critical
estimated: 16
assignee: ''
test_results:
  - timestamp: 2026-02-24T14:30:00.000Z
    note: 'Parser implementation complete. Parser tests: 302 passing (Phase 2)'
  - timestamp: 2026-02-27T05:15:00.000Z
    note: 'Parser updated to emit actionable recovery suggestions for unclosed blocks. All parser tests pass (305/305).'
actual: 16
completed_date: 2026-02-24
commits:
  3107bc5: 'feat(core): implement Chevrotain parser with recursive descent'
  56e66f8: 'feat(parser): enhance error handling with recovery suggestions for unclosed statements'
  913ee9b: 'test(core): add 8 edge case tests to improve parser coverage'
  a9aeb34: 'docs: add comprehensive JSDoc to expression parser module'
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/3107bc5'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/2'
---

## Goal

Build parser layer using Chevrotain that converts token stream into Abstract Syntax Tree.

## Background

Parser consumes tokens and builds syntactic structure representing template logic. Supports:

- If/else conditional blocks
- For loops with nested iteration
- Variable expressions with dot notation
- Block definitions for content sections
- Error recovery with best-effort parsing

**Related ADRs**: [[ADR-002 Parser Selection]], [[ADR-006 Testing Strategy]]

## Tasks

- [x] Define AST node types in `types.ts` (IfNode, ForNode, ExprNode, etc.)
- [x] Implement Chevrotain parser in `packages/core/src/parser.ts`
- [x] Support all statement types: if, for, block, set
- [x] Support expression types: variables, filters, function calls
- [x] Implement error recovery (continue parsing after errors)
- [x] Add validation: balanced delimiters, typed expressions
- [x] Write 300+ unit tests for parser
- [x] Verify <5ms parsing for 4KB template

## Deliverables

- Chevrotain parser implementation
- Complete AST node type definitions
- Error recovery mechanism
- 300+ passing tests with snapshots
- Performance benchmarks

## Acceptance Criteria

- [x] Parses all statement types correctly
- [x] Generates correct AST structure
- [x] Handles nested blocks and loops
- [x] Error recovery produces partial ASTs
- [x] 300+ tests passing with 95%+ coverage
- [x] Parsing <5ms for 4KB template
- [x] Error messages include recovery suggestions

## Example AST Output

```typescript
parse('{% for user in users %}{{ user.name }}{% endfor %}')
// Returns:
{
  type: 'template',
  children: [
    {
      type: 'for',
      iterator: 'user',
      iterable: { type: 'variable', name: 'users' },
      body: [
        {
          type: 'expression',
          value: { type: 'variable', name: 'user', property: 'name' }
        }
      ]
    }
  ]
}
```

## References

- ADR-002: Parser Selection
- [Chevrotain Parser Tutorial](https://chevrotain.io/docs/tutorial/step1_lexing.html)
- Handlebars parser reference: <https://github.com/handlebars-lang/handlebars.js>

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]]
- Unblocks: [[7 Implement AST Renderer]], [[10 Write Parser Tests]]
