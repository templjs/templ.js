---
id: wi-008
type: work-item
subtype: story
lifecycle: active
title: '8: Implement Query Engine (Variables, Filters, Functions)'
status: closed
status_reason: completed
priority: high
estimated: 12
assignee: ''
test_results:
  - timestamp: 2026-02-24T14:30:00.000Z
    note: 'Query engine implementation complete. Tested via renderer integration'
actual: 12
completed_date: 2026-02-24
commits:
  51c6dcf: 'feat(core): implement query engine with dot notation and JMESPath support'
links:
  depends_on:
    - '[[002_monorepo_setup]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/51c6dcf'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/2'
---

## Goal

Build query processing system supporting dot notation, filters, and built-in functions.

## Background

Queries are expressions like `user.profile.name | upper | default("Anonymous")`. Query engine must:

- Parse query syntax
- Resolve nested object access
- Apply filters in sequence
- Handle built-in functions
- Provide type information for IDE

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [x] Create `packages/core/src/query-engine.ts`
- [x] Implement dot notation resolver (user.profile.name)
- [x] Implement array access (items[0], items[index])
- [x] Implement filter parsing and execution
- [x] Add filter composition (chaining with pipes)
- [x] Implement function call support
- [x] Create `packages/core/src/functions/` subdirectory for function modules:
  - [x] `string-functions.ts` (upper, lower, trim, replace, slice, split, join, etc.)
  - [x] `number-functions.ts` (round, floor, ceil, abs, min, max, clamp, sqrt, pow, etc.)
  - [x] `datetime-functions.ts` (now, format, parse, addDays, addHours, timezone, etc.)
  - [x] `array-functions.ts` (length, first, last, reverse, sort, unique, filter, map, etc.)
  - [x] `object-functions.ts` (keys, values, entries, has, get, merge, pick, omit)
- [x] Add function registry and dispatch system
- [x] Add error handling (undefined paths, type errors, invalid arguments)
- [x] Implement type inference for function signatures (for IDE)
- [x] Expose query metadata for IDE (types, available properties, function signatures)

## Deliverables

- Query engine implementation with comprehensive function library
- 50+ built-in functions across 5 categories (string, number, datetime, array, object)
- Function signature registry for IDE completion
- Type inference system
- 150+ passing tests

## Acceptance Criteria

- [ ] Dot notation resolves correctly
- [ ] Array access works with literals and variables
- [ ] Filters chain correctly
- [ ] All 50+ built-in functions implemented and working
- [ ] Functions accept correct argument types/counts
- [ ] 150+ tests passing with <5% failure rate
- [ ] Type information available for IDE completion
- [ ] Performance: Filter chains <1ms for typical usage

## Built-in Functions (50+)

**String Functions** (19):

- `upper(str)` - Convert to uppercase
- `lower(str)` - Convert to lowercase
- `capitalize(str)` - Capitalize first letter
- `trim(str)` - Remove leading/trailing whitespace
- `ltrim(str)` - Remove leading whitespace only
- `rtrim(str)` - Remove trailing whitespace only
- `replace(str, search, replacement)` - Replace occurrences
- `slice(str, start, end)` - Extract substring
- `split(str, delimiter)` - Split into array
- `join(arr, delimiter)` - Join array into string
- `startsWith(str, prefix)` - Check prefix match
- `endsWith(str, suffix)` - Check suffix match
- `includes(str, substring)` - Check substring exists
- `indexOf(str, substring)` - Find index of substring
- `padStart(str, length, char)` - Pad left side
- `padEnd(str, length, char)` - Pad right side
- `repeat(str, count)` - Repeat string N times
- `reverse(str)` - Reverse string characters
- `escape(str)` - HTML escape special characters

**Number Functions** (15):

- `round(num, decimals)` - Round to decimal places
- `floor(num)` - Round down to integer
- `ceil(num)` - Round up to integer
- `abs(num)` - Absolute value
- `min(num1, num2, ...)` - Minimum of values
- `max(num1, num2, ...)` - Maximum of values
- `clamp(num, min, max)` - Constrain to range
- `sqrt(num)` - Square root
- `pow(num, exponent)` - Power (num^exponent)
- `log(num, base)` - Logarithm
- `exp(num)` - Exponential (e^x)
- `sin(num)`, `cos(num)`, `tan(num)` - Trigonometric functions
- `sum(arr)` - Sum all array elements
- `avg(arr)` - Average of array elements
- `product(arr)` - Multiply all array elements

**Datetime Functions** (12):

- `now()` - Current ISO 8601 timestamp
- `format(date, pattern)` - Format date (YYYY-MM-DD, etc.)
- `parse(str, pattern)` - Parse date string
- `addDays(date, days)` - Add/subtract days
- `addHours(date, hours)` - Add/subtract hours
- `addMinutes(date, minutes)` - Add/subtract minutes
- `getYear(date)` - Extract year
- `getMonth(date)` - Extract month (1-12)
- `getDay(date)` - Extract day of month
- `getHour(date)` - Extract hour
- `timezone(date, tz)` - Convert timezone (e.g., 'UTC' to 'EST')
- `timestamp(date)` - Unix timestamp in milliseconds

**Array Functions** (16):

- `length(arr)` - Number of elements
- `first(arr)` - First element
- `last(arr)` - Last element
- `nth(arr, index)` - Element at index (with bounds checking)
- `reverse(arr)` - Reverse array order
- `sort(arr, key)` - Sort by value or object key
- `unique(arr, key)` - Remove duplicates (by key for objects)
- `flatten(arr, depth)` - Flatten nested arrays
- `slice(arr, start, end)` - Extract subarray
- `concat(arr1, arr2, ...)` - Concatenate arrays
- `join(arr, delimiter)` - Join as string
- `filter(arr, condition)` - Filter by condition
- `map(arr, transform)` - Transform each element
- `find(arr, condition)` - Find first matching element
- `includes(arr, value)` - Check if value in array
- `indexOf(arr, value)` - Find index of value

**Object Functions** (9):

- `keys(obj)` - Array of object keys
- `values(obj)` - Array of object values
- `entries(obj)` - Array of [key, value] pairs
- `has(obj, key)` - Check if key exists
- `get(obj, key, default)` - Get value with fallback
- `merge(obj1, obj2, ...)` - Shallow merge objects
- `pick(obj, keys)` - Select specific keys
- `omit(obj, keys)` - Exclude specific keys
- `length(obj)` - Number of keys

**Utility Function** (1):

- `default(value, fallback)` - Null coalescing operator

## Example Queries

- `user.profile.name` - Nested property access
- `items[0]` - Array access by index
- `message | upper` - Simple filter
- `name | default("Guest")` - Filter with argument
- `text | upper | escape` - Filter chain
- `price | round(2)` - Number formatting
- `birthDate | format('YYYY-MM-DD')` - Datetime formatting
- `temperature | round(1) | clamp(0, 100)` - Chained transformations
- `items | map('name') | join(', ')` - Array operations with chaining
- `data | keys | length` - Object introspection
- `values | filter('> 10') | sum` - Complex filtering and aggregation

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]], [[6 Implement Chevrotain Parser]]
- Parallel with: [[7 Implement AST Renderer]]
