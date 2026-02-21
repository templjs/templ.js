---
id: wi-005
type: work-item
subtype: story
lifecycle: active
title: '5: Implement Chevrotain Lexer with Configurable Delimiters'
status: in-progress
priority: critical
estimated: 12
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.077Z
    note: Lexer implemented; 107 tests passing (local vitest run)
actual: 0
commits:
  24232eb: 'feat(core): implement Chevrotain lexer with tests'
links:
  depends_on:
    - '[[002_monorepo_setup]]'
---

## Goal

Build tokenization layer using Chevrotain that supports default and custom delimiters.

## Background

Tokenizer converts template strings into tokens with position metadata. Must support:

- Default delimiters: `{% %}`, `{{ }}`, `{# #}`
- Custom delimiters: Any string pair configuration
- All token types: text, statement, expression, comment
- Accurate line/column tracking

**Related ADRs**: [[ADR-002 Parser Selection]], [[ADR-006 Testing Strategy]]

## Tasks

- [x] Create `packages/core/src/types.ts` with token interfaces
- [x] Implement `TokenType` enum (TEXT, STATEMENT, EXPRESSION, COMMENT)
- [x] Create Chevrotain lexer in `packages/core/src/lexer.ts`
- [x] Support configurable delimiters via options object
- [x] Add error handling for malformed delimiters
- [x] Implement position tracking (line/column)
- [x] Write 200+ unit tests for lexer
- [x] Verify <1ms tokenization for 4KB template

## Deliverables

- Chevrotain-based lexer implementation
- Token type definitions
- Configurable delimiter support
- 200+ passing tests
- Performance benchmarks

## Acceptance Criteria

- [ ] Default delimiters work correctly
- [ ] Custom delimiters work correctly
- [ ] All character positions tracked accurately
- [ ] 200+ tests passing with 95%+ coverage
- [ ] Tokenization <1ms for 4KB template
- [ ] Error messages reference exact positions

## Example Test

```typescript
it('should tokenize expression with custom delimiters', () => {
  const tokens = tokenize('Hello <: user.name :>', {
    expression_start: '<:',
    expression_end: ':>',
  });
  expect(tokens).toHaveLength(3);
  expect(tokens[1].type).toBe(TokenType.EXPRESSION);
});
```

## References

- ADR-002: Parser Selection
- [Chevrotain Getting Started](https://github.com/Chevrotain/chevrotain/tree/master/packages/chevrotain)
- Handlebars lexer for reference: [Handlebars on GitHub](https://github.com/handlebars-lang/handlebars.js)

## Dependencies

- Requires: [[2 Initialize Monorepo]]
- Unblocks: [[6 Implement Chevrotain Parser]], [[9 Write Lexer Tests]]
