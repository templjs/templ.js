---
id: wi-050
type: work-item
subtype: story
lifecycle: draft
title: '050: Add Schema-Guided Extraction and Validation'
status: proposed
priority: medium
estimated: 8
actual: 0
assignee: ''
links:
  depends_on:
    - '[[049_extraction_engine]]'
    - '[[008_query_engine]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/42'
---

## Goal

Enhance extraction engine with schema-guided extraction: use schema information to improve extraction accuracy, apply type coercion, and validate extracted data.

## Background

WI-049 implements basic extraction that returns strings. However, with schema information we can:

1. **Type Coercion**: Convert extracted strings to proper types (number, boolean, date)
2. **Ambiguity Resolution**: Use schema constraints to prefer certain extractions
3. **Validation**: Ensure extracted data matches schema requirements
4. **Required Fields**: Detect missing required fields
5. **Array Length Hints**: Use minItems/maxItems to guide loop extraction
6. **Format Constraints**: Parse dates, emails, URLs according to schema formats

This makes extraction more robust and catches errors early.

## Tasks

- [ ] Integrate schema into extraction process
- [ ] Implement type coercion for primitive types
- [ ] Implement date/datetime parsing with formats
- [ ] Implement number parsing (int, float)
- [ ] Implement boolean inference (true/false, yes/no, etc.)
- [ ] Add schema validation to extraction results
- [ ] Use schema constraints for ambiguity resolution
- [ ] Report schema validation errors with positions
- [ ] Add tests for type coercion
- [ ] Add tests for schema validation errors
- [ ] Document schema-based extraction features

## Deliverables

- `src/packages/core/src/extraction/schema-extractor.ts` - Schema-aware extraction
- `src/packages/core/src/extraction/type-coercion.ts` - Type coercion utilities
- `src/packages/core/src/extraction/validation.ts` - Post-extraction validation
- Unit tests in `src/packages/core/src/extraction/*.test.ts`
- Documentation in `docs/extraction.md`

## Acceptance Criteria

- [ ] String to number coercion works
- [ ] String to boolean coercion works
- [ ] Date format parsing works (ISO 8601, custom formats)
- [ ] Schema validation detects type mismatches
- [ ] Schema validation detects missing required fields
- [ ] Schema validation detects invalid enum values
- [ ] Array minItems/maxItems guide loop extraction
- [ ] Validation errors include line/column positions
- [ ] 85%+ code coverage for validation module

## Type Coercion Examples

### Number Extraction

Template: `Total: {{ total }}`
Output: `Total: 42.5`
Schema: `{ "type": "number" }`
Result: `{ total: 42.5 }` (not string "42.5")

### Boolean Extraction

Template: `Active: {{ active }}`
Output: `Active: true`
Schema: `{ "type": "boolean" }`
Result: `{ active: true }` (boolean, not string "true")

### Date Extraction

Template: `Date: {{ publishDate }}`
Output: `Date: 2026-03-10`
Schema: `{ "type": "string", "format": "date" }`
Result: `{ publishDate: "2026-03-10" }` (validated ISO date)

### Enum Validation

Template: `Status: {{ status }}`
Output: `Status: approved`
Schema: `{ "enum": ["pending", "approved", "rejected"] }`
Result: Valid extraction
Invalid: `Status: invalid` → validation error

## Schema-Guided Ambiguity Resolution

For template:

```liquid
{% for item in items %}{{ item }}{% endfor %}
```

Output: `123`

Without schema: Ambiguous (["1","2","3"], ["12","3"], ["1","23"], ["123"])

With schema `items: { type: "array", items: { type: "number" }, minItems: 3 }`:
Prefer `[1, 2, 3]` (satisfies minItems)

## Validation Error Examples

```typescript
{
  success: false,
  errors: [
    {
      message: "Expected number, got string 'abc'",
      path: "total",
      line: 3,
      column: 8
    },
    {
      message: "Missing required field 'email'",
      path: "user.email",
      line: null,
      column: null
    }
  ]
}
```

## Non-Goals

- Complex custom validators
- Cross-field validation (e.g., endDate > startDate)
- Machine learning-based type inference
- Automatic schema generation from output
