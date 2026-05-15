---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:047-template-extraction
title: '047: Template Extraction Framework (Reverse Rendering)'
summary: Template Extraction Framework (Reverse Rendering)
type: work-item
subtype: epic
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 40
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-047-template-extraction]]'
---

## Goal

Implement data extraction (reverse rendering) capability: given a schema, template, and concrete rendered output, extract the original structured data that produced the output.

## Background

Currently, templjs supports one-directional transformation: `data + template → output`. Template extraction enables the inverse operation: `output + template + schema → data`. This unlocks powerful use cases:

1. **Data Recovery**: Extract structured data from legacy documents that were template-generated
2. **Round-trip Validation**: Verify template correctness by ensuring `extract(render(data)) === data`
3. **Content Migration**: Parse existing documents into structured data for system migration
4. **Template Testing**: Generate test data from example outputs
5. **Form Parsing**: Extract user inputs from filled-in template forms

### Example Use Case

Given a template:

```markdown
# {{ title }}

**Author**: {{ author.name }}
**Date**: {{ publishDate }}

{{ content }}
```

And a rendered output:

```markdown
# My Blog Post

**Author**: John Doe
**Date**: 2026-03-10

This is the content of my blog post.
```

And a schema defining the structure, extraction would produce:

```json
{
  "title": "My Blog Post",
  "author": {
    "name": "John Doe"
  },
  "publishDate": "2026-03-10",
  "content": "This is the content of my blog post."
}
```

## Architecture

The extraction system works through several components:

1. **Template Parser**: Parse template into extraction rules (expressions, static text, conditionals)
2. **Pattern Matcher**: Match rendered output against template structure
3. **Value Extractor**: Extract values from matched regions based on schema types
4. **Schema Validator**: Validate extracted data against schema and apply type coercion
5. **Ambiguity Resolver**: Handle multiple possible extractions with heuristics/user guidance

## Technical Challenges

1. **Ambiguity**: Multiple data sets may produce the same output
2. **Whitespace**: Handling whitespace normalization and preservation
3. **Conditionals**: Inferring which branches were taken
4. **Loops**: Determining iteration boundaries and counts
5. **Type Inference**: Coercing string matches to schema types (dates, numbers, booleans)
6. **Partial Matches**: Handling incomplete or malformed outputs

## Work Items

This epic breaks down into the following work items:

- **WI-048**: Design extraction algorithm and API surface
- **WI-049**: Implement core extraction engine with pattern matching
- **WI-050**: Add schema-guided extraction and validation
- **WI-051**: Implement extraction CLI command (`templjs extract`)
- **WI-052**: Write comprehensive tests and documentation

## Success Criteria

- [ ] Simple expression extraction working ({{ var }})
- [ ] Nested object extraction working ({{ obj.field }})
- [ ] Array iteration extraction working ({% for item in items %})
- [ ] Conditional extraction working ({% if condition %})
- [ ] Schema validation and type coercion working
- [ ] CLI command functional with examples
- [ ] 80%+ test coverage for extraction code
- [ ] Round-trip test: extract(render(data)) === data for test cases
- [ ] Documentation with examples and limitations

## Non-Goals (Future Work)

- Complex ambiguity resolution (user must provide hints)
- Machine learning-based extraction
- Template inference from examples only (schema + template required)
- Supporting all template edge cases (focus on common patterns)

## Relationships

- `depends_on`: [[work-item-033-schema-parity]]
- `depends_on`: [[work-item-008-query-engine]]
- `depends_on`: [[work-item-007-ast-renderer]]
