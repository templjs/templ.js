---
id: wi-011
type: work-item
subtype: task
lifecycle: active
title: '11: Write Renderer and Query Engine Tests (200+ tests)'
status: in-progress
priority: critical
estimated: 14
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.082Z
    note: Pending - renderer and query engine test files not yet created
actual: 0
links:
  depends_on:
    - '[[007_ast_renderer]]'
    - '[[008_query_engine]]'
---

## Goal

Comprehensive test coverage for renderer and query engine with 95%+ coverage.

## Background

Ports ~200 Python pytest tests from temple/tests/test_renderer.py and query tests to TypeScript Vitest.

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [ ] Create `packages/core/tests/renderer.test.ts`
- [ ] Port variable resolution tests
- [ ] Port loop execution tests
- [ ] Port conditional execution tests
- [ ] Create `packages/core/tests/query-engine.test.ts`
- [ ] Create `packages/core/tests/functions/`:
  - [ ] `string-functions.test.ts` (19 functions, 150+ tests)
  - [ ] `number-functions.test.ts` (15 functions, 100+ tests)
  - [ ] `datetime-functions.test.ts` (12 functions, 80+ tests)
  - [ ] `array-functions.test.ts` (16 functions, 120+ tests)
  - [ ] `object-functions.test.ts` (9 functions, 80+ tests)
- [ ] Port error handling tests
- [ ] Add end-to-end render pipeline tests with complex scenarios
- [ ] Achieve 95%+ line/branch coverage for all functions

## Test Categories (350+ tests)

- **Variable Resolution** (40 tests):
  - Dot notation (nested, deep nesting, special cases)
  - Array access (literal index, variable index, bounds checking)
  - Edge cases (undefined paths, null values, type mismatches)

- **String Functions** (150 tests):
  - Basic: upper, lower, capitalize, trim, ltrim, rtrim
  - Manipulation: replace, slice, split, join
  - Checking: startsWith, endsWith, includes, indexOf
  - Padding: padStart, padEnd, repeat, reverse
  - Escaping: escape (HTML, special characters)
  - Edge cases: empty strings, Unicode, null values

- **Number Functions** (100 tests):
  - Rounding: round, floor, ceil (various precisions and edge cases)
  - Comparisons: min, max, clamp (single/multiple values)
  - Math: sqrt, pow, log, exp with edge cases
  - Trigonometric: sin, cos, tan with degree/radian conversion
  - Aggregation: sum, avg, product (empty arrays, nulls, mixed types)

- **Datetime Functions** (80 tests):
  - Parsing: parse with multiple format patterns
  - Formatting: format with standard patterns (YYYY-MM-DD HH:mm:ss, etc.)
  - Manipulation: addDays, addHours, addMinutes (positive/negative)
  - Extraction: getYear, getMonth, getDay, getHour
  - Timezone: conversion, UTC, common timezones
  - Edge cases: leap years, daylight saving time boundaries

- **Array Functions** (120 tests):
  - Access: length, first, last, nth (bounds, edge cases)
  - Ordering: reverse, sort (by value and by key)
  - Deduplication: unique (by value and by key)
  - Transformation: flatten, slice, concat, join
  - Filtering: filter with conditions, find, includes, indexOf
  - Mapping: map with transformations
  - Edge cases: empty arrays, single elements, nested structures

- **Object Functions** (80 tests):
  - Introspection: keys, values, entries
  - Access: get with defaults, has checks
  - Manipulation: merge (single/multiple), pick, omit
  - Type handling: null values, prototype properties
  - Edge cases: empty objects, special property names

- **Control Flow** (50 tests):
  - If/else branching with conditions
  - Loop iteration (for simple and complex data)
  - Nested control structures

- **Filter Chaining** (60 tests):
  - 2-filter chains (upper|escape, etc.)
  - 3+ filter chains (complex transformations)
  - Functions with arguments in chains
  - Error propagation through chains

- **Error Handling** (30 tests):
  - Undefined variables and paths
  - Type errors (calling string function on number)
  - Invalid argument counts
  - Invalid function names
  - Graceful error messages

## Deliverables

- 350+ passing Vitest tests covering all functions
- 95%+ code coverage for renderer and query engine
- 50+ built-in functions fully tested
- Integration test coverage for complex scenarios
- Performance regression detection baselines

## Acceptance Criteria

- [ ] All 350+ tests passing
- [ ] Coverage report shows 95%+ line coverage
- [ ] Coverage report shows 90%+ branch coverage
- [ ] All 50+ built-in functions tested with edge cases
- [ ] String function tests: 150+ tests, 95%+ coverage
- [ ] Number function tests: 100+ tests, 95%+ coverage
- [ ] Datetime function tests: 80+ tests, 95%+ coverage
- [ ] Array function tests: 120+ tests, 95%+ coverage
- [ ] Object function tests: 80+ tests, 95%+ coverage
- [ ] Filter chaining tests: 60+ tests
- [ ] Integration tests passing (parse → render pipeline)
- [ ] Performance: Single function call <1ms, chain <5ms

## Example Tests

```typescript
describe('String Functions', () => {
  it('should chain string transformations', () => {
    const ast = parse('{{ text | trim | upper | escape }}');
    const output = render(ast, { text: '  <hello>  ' });
    expect(output).toBe('&lt;HELLO&gt;');
  });

  it('should split and join strings', () => {
    const ast = parse('{{ csv | split(",") | map(trim) | join("; ") }}');
    const output = render(ast, { csv: 'a, b, c' });
    expect(output).toBe('a; b; c');
  });
});

describe('Number Functions', () => {
  it('should round and clamp values', () => {
    const ast = parse('{{ temp | round(1) | clamp(0, 100) }}');
    const output = render(ast, { temp: 98.67 });
    expect(output).toBe('98.7');
  });

  it('should sum and average arrays', () => {
    const ast = parse('{{ scores | sum }} (avg: {{ scores | avg }})');
    const output = render(ast, { scores: [85, 90, 95] });
    expect(output).toBe('270 (avg: 90)');
  });
});

describe('Datetime Functions', () => {
  it('should format dates', () => {
    const ast = parse('{{ date | format("YYYY-MM-DD") }}');
    const output = render(ast, { date: new Date('2025-02-17') });
    expect(output).toBe('2025-02-17');
  });
});

describe('Array Functions', () => {
  it('should filter and map arrays', () => {
    const ast = parse('{{ items | filter("price > 10") | map("name") | join(", ") }}');
    const output = render(ast, {
      items: [
        { name: 'A', price: 5 },
        { name: 'B', price: 15 },
      ],
    });
    expect(output).toBe('B');
  });

  it('should sort and deduplicate', () => {
    const ast = parse('{{ values | unique | sort }}');
    const output = render(ast, { values: [3, 1, 2, 1, 3] });
    expect(output).toBe('1,2,3');
  });
});

describe('Object Functions', () => {
  it('should extract keys and values', () => {
    const ast = parse('Keys: {{ obj | keys | join(", ") }}');
    const output = render(ast, { obj: { a: 1, b: 2 } });
    expect(output).toBe('Keys: a, b');
  });
});

describe('Filter Chaining', () => {
  it('should handle complex multi-stage transformations', () => {
    const ast = parse('{{ items | map("price") | filter("> 50") | sum | round(2) }}');
    const output = render(ast, {
      items: [{ price: 45 }, { price: 65 }, { price: 100 }],
    });
    expect(output).toBe('165');
  });
});
```

## Run Tests

```bash
nx test core --coverage
```

## References

## Dependencies

- Requires: [[7 Implement AST Renderer]], [[8 Implement Query Engine]]
- Unblocks: [[12 Build Volar Language Server Plugin]] (core library complete)
