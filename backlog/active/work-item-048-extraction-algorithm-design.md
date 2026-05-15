---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:048-extraction-algorithm-design
title: '048: Design Template Extraction Algorithm and API'
summary: Design Template Extraction Algorithm and API
type: work-item
subtype: story
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 4
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/42
    - https://github.com/templjs/templ.js/pull/43
  evidence:
    - '[[record-20260514-223855-048-extraction-algorithm-design]]'
---

## Goal

Design the extraction algorithm, API surface, and data structures for template-based data extraction (reverse rendering).

## Background

Before implementing extraction, we need to:

1. Define the algorithm for matching rendered output against template structure
2. Design the TypeScript API for extraction functionality
3. Specify data structures for extraction rules and intermediate results
4. Document limitations and edge cases
5. Create example test cases to guide implementation

This design work will guide WI-049 (implementation) and ensure a clean, extensible architecture.

## Tasks

- [ ] Document extraction algorithm pseudocode
- [ ] Design ExtractionEngine interface
- [ ] Design ExtractionResult type (success/failure with diagnostics)
- [ ] Define ExtractionRule data structure (per template token)
- [ ] Design API for extract() function signature
- [ ] Document ambiguity resolution strategy
- [ ] Create 10+ example test cases (input/template/expected output)
- [ ] Document known limitations and non-supported patterns
- [ ] Review design with stakeholders
- [ ] Update WI-048 epic with design decisions

## Deliverables

- Design document in `docs/design/extraction-algorithm.md`
- TypeScript interface definitions in `src/packages/core/src/extraction/types.ts` (stub)
- Test case examples in `docs/design/extraction-examples.md`
- Updated epic documentation

## Acceptance Criteria

- [ ] Algorithm can handle simple expressions ({{ var }})
- [ ] Algorithm can handle nested access ({{ obj.field }})
- [ ] Algorithm can handle conditionals ({% if %})
- [ ] Algorithm can handle loops ({% for %})
- [ ] Algorithm can handle nested constructs (loops within conditionals, etc.)
- [ ] Algorithm can handle filters ({{ var | filter }}) by using inverse filter logic if available
- [ ] Algorithm has a clear strategy for ambiguity resolution
- [ ] API design reviewed and approved
- [ ] At least 10 test cases documented
- [ ] Edge cases and limitations documented

## Key Design Questions

1. **Parsing Strategy**: Parse template once and generate extraction rules, or parse on-the-fly?
2. **Ambiguity Handling**: Greedy matching or backtracking? User hints required?
3. **Whitespace**: Normalize or preserve? Configurable?
4. **Type Coercion**: Where does schema validation happen? Before or after extraction?
5. **Error Reporting**: What granularity of errors? Line/column positions in output?
6. **State Management**: How to track extraction context during traversal?

## Example API Design (Sketch)

```typescript
interface ExtractionOptions {
  schema: Schema;
  template: string;
  output: string;
  strictWhitespace?: boolean;
  allowAmbiguous?: boolean;
}

interface ExtractionResult {
  success: boolean;
  data?: unknown;
  errors?: ExtractionError[];
  warnings?: ExtractionWarning[];
}

function extract(options: ExtractionOptions): ExtractionResult;
```

## Non-Goals

- Full implementation (deferred to WI-049)
- CLI integration (deferred to WI-051)
- Complex optimization strategies

## Relationships

- `depends_on`: [[work-item-047-template-extraction]]
- `depends_on`: [[work-item-006-chevrotain-parser]]
