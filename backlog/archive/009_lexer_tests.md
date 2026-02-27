---
id: wi-009
type: work-item
subtype: task
lifecycle: active
title: '9: Write Lexer Tests (200+ tests)'
status: closed
status_reason: completed
priority: critical
estimated: 8
assignee: ''
test_results:
  - timestamp: 2026-02-24T14:30:00.000Z
    note: 'Lexer tests: 207 passing (Phase 2 complete)'
actual: 8
completed_date: 2026-02-24
commits:
  a0ee8e4: 'test(core): enhance and fix lexer tests to 200+ tests (all passing)'
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/a0ee8e4'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/2'
---

## Goal

Comprehensive test coverage for lexer functionality with 95%+ coverage.

## Background

Ports ~200 Python pytest tests from temple/tests/test_tokenizer.py to TypeScript Vitest.

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [x] Setup Vitest test environment in `packages/core/tests/`
- [x] Create `packages/core/tests/lexer.test.ts`
- [x] Port basic tokenization tests
- [x] Port delimiter configuration tests
- [x] Port position tracking tests
- [x] Port error handling tests
- [x] Add snapshot tests for complex templates
- [x] Add performance benchmarks
- [x] Achieve 95%+ line/branch coverage

## Test Categories (200+ tests)

- **Basic Tokenization** (50 tests):
  - Individual token types (statement, expression, comment, text)
  - Whitespace handling and preservation
  - Escape sequences (\\{, \\}, backslash handling)
  - Mixed content (alternating text and tokens)
  - Boundary detection and token splitting
- **Delimiter Variations** (40 tests):
  - Default delimiters: `{% %}`, `{{ }}`, `{# #}`
  - Custom single-character delimiters
  - Custom multi-character delimiters (e.g., `<<`, `>>`, `<:`, `:>`)
  - Delimiter conflicts and precedence
  - Empty delimiters (error cases)
- **Position Tracking** (30 tests):
  - Line and column accuracy for all token types
  - Multi-line statement handling (position at start, end, intermediate)
  - Position correctness after escaped characters
  - Position preservation through rendering
  - Error reporting with accurate positions
- **Error Handling** (30 tests):
  - Unclosed statement tags (recovery behavior)
  - Unclosed expression tags
  - Malformed expressions (missing operators, extra tokens)
  - Invalid delimiter combinations
  - Nested delimiters (intentional vs accidental)
- **Performance** (10 tests):
  - Tokenization of 1KB, 10KB, 100KB templates (<100ms)
  - LRU cache effectiveness (repeated templates)
  - Memory usage profiling
  - Streaming tokenization if applicable
- **Edge Cases** (40 tests):
  - Empty templates (return no tokens)
  - Only whitespace (return text token)
  - Only delimiters (no content)
  - Consecutive delimiters without content
  - Unicode characters in text and expressions
  - Very long token values (>1MB)
  - Mixed encodings and special characters

## Deliverables

- 200+ passing Vitest tests
- 95%+ code coverage report
- Performance benchmarks
- Snapshot test baselines

## Acceptance Criteria

- [x] All 200+ tests passing
- [x] Coverage report shows 95%+ line coverage
- [x] Coverage report shows 90%+ branch coverage
- [x] Snapshots committed and passing
- [x] Benchmarks baseline established

## Run Tests

```bash
nx test core --coverage
```

## References

- [Vitest Test API](https://vitest.dev/api/)

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]]
