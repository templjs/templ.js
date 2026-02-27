---
id: wi-025
type: work-item
subtype: task
lifecycle: active
title: '025: Implement JSON Schema Validation System'
status: ready-for-review
status_reason: awaiting-review
priority: critical
estimated: 8
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.091Z
    note: Schema validation implemented; 62 tests passing (local vitest run)
  - timestamp: 2026-02-27T00:49:27Z
    note: Re-validated `SchemaValidator` suite with `pnpm --dir src/packages/core test src/schema/SchemaValidator.test.ts` (62/62 passing)
actual: 0
commits:
  4a38b95: 'feat(schema): implement JSON Schema validation and inference'
  1768d15: 'chore(core): add ajv dependencies for schema validation'
links:
  depends_on:
    - '[[002_monorepo_setup]]'
---

## Goal

Build comprehensive JSON Schema validation system for template input data with query path validation and schema inference.

## Background

Schema validation ensures queries reference valid data paths before rendering, preventing runtime errors. Critical for developer experience and IDE features.

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [x] Install dependencies: `ajv`, `ajv-formats`
- [x] Create `packages/core/src/schema/` directory
- [x] Implement `SchemaValidator` class using ajv:
  - Load and compile JSON Schema v7 files
  - Validate data against schema
  - Generate human-readable error messages
  - Implement compiled schema caching
- [x] Implement query path validation:
  - Extract queries from AST nodes
  - Verify query paths exist in schema definition
  - Fuzzy matching for "Did you mean..." suggestions
- [x] Implement schema inference:
  - Infer JSON Schema from sample data
  - Detect field types (string, number, array, object)
- [x] Add schema-aware metadata export:
  - Available variables by name and type
  - Property names at each level (for IDE completion)
  - Support optional vs required fields
- [x] Support $ref resolution for external schema files
- [x] Write 50+ validation tests

## Deliverables

- `SchemaValidator` class with ajv integration
- Query path validation with suggestions
- Schema inference from sample data
- 50+ passing tests
- Schema metadata for IDE (type info, available properties)

## Acceptance Criteria

- [x] Validates data against JSON Schema v7
- [x] Detects undefined paths: `{{ user.missingField }}`
- [x] Suggests corrections: "Did you mean user.firstName?"
- [x] Infers schema from sample JSON
- [x] Compiled schemas cached (100x faster on reuse)
- [x] Metadata exports types for IDE completion
- [x] 50+ tests passing with 95%+ coverage

## Example Output

```typescript
const validator = new SchemaValidator(schema);
const result = validator.validate(data);
// {
//   valid: false,
//   errors: [
//     {
//       path: 'user.missingfield',
//       message: 'Property not found in schema',
//       suggestion: 'Did you mean user.firstName?'
//     }
//   ]
// }

const metadata = validator.getMetadata();
// {
//   user: { type: 'object', properties: ['firstName', 'email', ...] },
//   items: { type: 'array', itemType: 'object' }
// }
```

## References

- ajv: <https://ajv.js.org/>
- JSON Schema: <https://json-schema.org/>

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]], [[6 Implement Chevrotain Parser]]
- Unblocks: [[14 Implement Diagnostics]], [[15 Implement IntelliSense]]
