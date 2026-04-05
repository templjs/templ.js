---
id: wi-049
type: work-item
subtype: story
lifecycle: draft
title: '049: Implement Core Template Extraction Engine'
status: proposed
priority: medium
estimated: 16
actual: 0
assignee: ''
links:
  depends_on:
    - '[[048_extraction_algorithm_design]]'
    - '[[007_ast_renderer]]'
    - '[[006_chevrotain_parser]]'
---

## Goal

Implement the core extraction engine that can reverse-render templates: given output and template, extract the source data.

## Background

Based on the design from WI-048, implement the extraction algorithm that:

1. Parses templates into extraction rules
2. Matches rendered output against template patterns
3. Extracts values from matched regions
4. Handles basic template constructs (expressions, conditionals, loops)
5. Reports extraction errors with positions

This is the core engine - schema validation (WI-050) and CLI (WI-051) build on this.

## Tasks

- [ ] Implement `ExtractionEngine` class
- [ ] Implement template-to-rules parser
- [ ] Implement pattern matching for static text
- [ ] Implement expression extraction ({{ var }})
- [ ] Implement nested property extraction ({{ obj.field }})
- [ ] Implement conditional extraction ({% if %})
- [ ] Implement loop extraction ({% for item in items %})
- [ ] Implement whitespace handling (configurable)
- [ ] Implement error reporting with positions
- [ ] Add unit tests for each construct type
- [ ] Add integration tests for complex templates
- [ ] Document internal architecture

## Deliverables

- `src/packages/core/src/extraction/engine.ts` - Main extraction engine
- `src/packages/core/src/extraction/rules.ts` - Rule generation from templates
- `src/packages/core/src/extraction/matchers.ts` - Pattern matching logic
- `src/packages/core/src/extraction/types.ts` - TypeScript interfaces
- Unit tests in `src/packages/core/src/extraction/*.test.ts`
- Integration tests in `src/packages/core/test/extraction.integration.test.ts`

## Acceptance Criteria

- [ ] Simple expression extraction works for all primitive types
- [ ] Nested object extraction works (3+ levels deep)
- [ ] Array extraction works with known length
- [ ] Conditional extraction works (if/else/elseif)
- [ ] Loop extraction works with simple arrays
- [ ] Whitespace normalization configurable
- [ ] Error messages include line/column positions
- [ ] 80%+ code coverage for extraction module
- [ ] All examples from WI-048 pass

## Implementation Notes

### Expression Extraction

For template `Hello {{ name }}!` and output `Hello World!`, extract:

```typescript
{
  name: 'World';
}
```

### Nested Properties

For template `{{ user.address.city }}` and output `New York`, extract:

```typescript
{
  user: {
    address: {
      city: 'New York';
    }
  }
}
```

### Conditionals

For template:

```liquid
{% if premium %}Premium{% else %}Free{% endif %}
```

And output `Premium`, extract:

```typescript
{
  premium: true;
}
```

### Loops

For template:

```liquid
{% for item in items %}{{ item }}{% endfor %}
```

And output `ABC`, extract:

```typescript
{
  items: ['A', 'B', 'C'];
}
```

(Note: Ambiguity - could be ["AB", "C"], ["A", "BC"], etc. Use greedy/heuristics)

## Non-Goals

- Schema validation (WI-050)
- CLI integration (WI-051)
- Complex ambiguity resolution
- Performance optimization (can be addressed later)

## Technical Challenges

1. **Backtracking**: When greedy match fails, need to backtrack
2. **Ambiguity**: Multiple valid extractions for same output
3. **Loop Boundaries**: Determining where iterations start/end
4. **Type Inference**: Strings vs numbers vs booleans in output
5. **Whitespace**: Template whitespace vs output whitespace mismatch
