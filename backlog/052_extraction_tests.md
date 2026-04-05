---
id: wi-052
type: work-item
subtype: task
lifecycle: draft
title: '052: Write Extraction Tests and Documentation'
status: proposed
priority: medium
estimated: 6
actual: 0
assignee: ''
links:
  depends_on:
    - '[[051_extraction_cli]]'
---

## Goal

Create comprehensive test suite and user documentation for template extraction feature.

## Background

With extraction engine, validation, and CLI complete (WI-049, WI-050, WI-051), we need:

1. **End-to-end tests**: Full extraction workflows from real examples
2. **Round-trip tests**: Verify extract(render(data)) === data
3. **Edge case tests**: Ambiguous cases, malformed output, partial matches
4. **Performance tests**: Ensure extraction scales to large documents
5. **User documentation**: Guide users through extraction use cases
6. **API reference**: Document extraction API for programmatic use

This ensures the feature is production-ready and usable.

## Tasks

- [ ] Write end-to-end extraction tests (10+ scenarios)
- [ ] Write round-trip tests (render → extract)
- [ ] Write edge case tests (ambiguity, errors, partial matches)
- [ ] Write performance benchmarks
- [ ] Create user guide: "Template Extraction Guide"
- [ ] Create API reference documentation
- [ ] Create example extraction projects
- [ ] Document limitations and best practices
- [ ] Add extraction to main README
- [ ] Record demo video/GIF for extraction workflow
- [ ] Update CHANGELOG for extraction feature

## Deliverables

- `src/packages/core/test/extraction-e2e.test.ts` - End-to-end tests
- `src/packages/core/test/extraction-roundtrip.test.ts` - Round-trip tests
- `src/packages/core/test/extraction-edge-cases.test.ts` - Edge case tests
- `docs/extraction-guide.md` - User guide
- `docs/api/extraction.md` - API reference
- `examples/extraction/` - Example projects
- Updated `README.md`
- `CHANGELOG.md` updates

## Acceptance Criteria

- [ ] 80%+ code coverage for extraction modules
- [ ] 10+ end-to-end test scenarios passing
- [ ] 5+ round-trip tests passing (extract(render) === identity)
- [ ] Edge cases documented and tested
- [ ] User guide covers all common use cases
- [ ] API reference is complete and accurate
- [ ] 3+ example projects demonstrating extraction
- [ ] Performance benchmark shows < 100ms for typical documents
- [ ] All extraction docs reviewed and approved

## End-to-End Test Scenarios

1. **Blog Post Extraction**: Markdown blog with title, author, date, content
2. **Configuration Extraction**: TOML config from rendered text file
3. **User Profile Extraction**: JSON user data from HTML profile page
4. **Invoice Extraction**: Structured invoice data from PDF-like text
5. **Form Data Extraction**: User inputs from filled form template
6. **Nested Objects**: Deep object hierarchies (3+ levels)
7. **Arrays**: Lists of items with multiple fields
8. **Conditionals**: Extract boolean flags from if/else branches
9. **Mixed Types**: Numbers, booleans, dates, strings in one document
10. **Large Document**: 1000+ line document with many fields

## Round-Trip Test Example

```typescript
test('round-trip: render then extract returns original data', () => {
  const data = {
    title: 'My Post',
    author: { name: 'Jane Doe' },
    publishDate: '2026-03-10',
    tags: ['tech', 'javascript'],
  };

  const template = `
# {{ title }}
By {{ author.name }} on {{ publishDate }}
Tags: {% for tag in tags %}{{ tag }} {% endfor %}
  `.trim();

  const schema = {
    /* schema definition */
  };

  // Render
  const rendered = render({ data, template });

  // Extract
  const extracted = extract({ output: rendered, template, schema });

  expect(extracted.data).toEqual(data);
});
```

## Documentation Structure

### User Guide (`docs/extraction-guide.md`)

1. Introduction: What is template extraction?
2. Quick Start: Simple example
3. Use Cases: When to use extraction
4. How It Works: Algorithm overview
5. Template Requirements: What makes a good extraction template
6. Schema Integration: Using schemas for better extraction
7. Handling Ambiguity: Best practices
8. Error Handling: Understanding extraction errors
9. CLI Usage: Command-line examples
10. Programmatic API: Using extraction in code
11. Limitations: Known edge cases and workarounds

### API Reference (`docs/api/extraction.md`)

- `extract()` function
- `ExtractionEngine` class
- `ExtractionOptions` interface
- `ExtractionResult` type
- `ExtractionError` type
- `TypeCoercion` utilities
- Configuration options

## Example Projects

1. `examples/extraction/blog-metadata/` - Extract blog frontmatter from rendered posts
2. `examples/extraction/form-parsing/` - Extract user form submissions
3. `examples/extraction/config-reverse/` - Reverse engineer config files

## Performance Targets

- Simple extraction (< 100 tokens): < 10ms
- Medium extraction (100-1000 tokens): < 50ms
- Large extraction (1000+ tokens): < 100ms
- Memory usage: < 50MB for typical documents

## Non-Goals

- Video tutorials (can be added later)
- Localized documentation
- Interactive extraction playground
- Automated example generation
