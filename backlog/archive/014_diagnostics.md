---
id: wi-014
type: work-item
subtype: story
title: '14: Implement Diagnostics (Linting)'
lifecycle: active
status: closed
status_reason: completed
priority: critical
estimated: 10
assignee: ''
actual: 10
completed_date: 2026-02-26
test_results:
  - timestamp: 2026-02-26T09:21:39Z
    note: 'Merged PR #5 and follow-up PR #7; diagnostics provider regression tests passed.'
commits:
  254277e: 'Merge pull request #5 from templjs/feature/wi-014-diagnostics'
  b68b993: 'Merge pull request #7 from templjs/fix/restore-diagnostic-provider'
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[027_virtual_code_mapping]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/254277ec9fd36b0ee5d4d7c4af43b7ed405624c9'
    - 'https://github.com/templjs/templ.js/commit/b68b993525ef1a7b97ecb1698bde9720fced92bb'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/5'
    - 'https://github.com/templjs/templ.js/pull/7'
---

## Goal

Provide real-time error reporting and linting for template syntax.

## Background

Diagnostics cover:

- Syntax errors: Unclosed tags, invalid delimiters
- Semantic errors: Undefined variables, type mismatches
- Base format errors: Delegated to VS Code language servers

**Related ADRs**: [[ADR-003 VS Code Architecture]], [[ADR-006 Testing Strategy]]

## Tasks

- [x] Implement diagnostic provider in Volar plugin
- [x] Detect unclosed template tags
- [x] Detect undefined variables (from schema)
- [x] Detect invalid filter usage
- [x] Collect base format errors from delegated services
- [x] Map errors back to original positions
- [x] Generate actionable error messages
- [x] Test error recovery (continue reporting all errors)
- [x] Write 30+ tests for diagnostics

## Deliverables

- Diagnostic provider implementation
- Error detection for all error types
- Position mapping for error locations
- 30+ passing tests
- Error message library

## Acceptance Criteria

- [x] Syntax errors reported immediately
- [x] Semantic validation (undefined variables)
- [x] Base format errors appearing in Problems panel
- [x] Error positions accurate to source
- [x] Error messages include fixes/suggestions
- [x] 30+ tests passing
- [x] <200ms diagnostic latency

## Error Types

| Error               | Message                                  | Fix Suggestion           |
| ------------------- | ---------------------------------------- | ------------------------ |
| Unclosed `{% if %}` | "Missing `{% endif %}`"                  | Insert `{% endif %}`     |
| Undefined variable  | "Variable 'user' not found in schema"    | Show available variables |
| Invalid filter      | "Filter 'unknown' not recognized"        | List available filters   |
| Type mismatch       | "Cannot iterate string (expected array)" | Convert to array         |

## Example Test

```typescript
it('should report undefined variable', async () => {
  const doc = await openDocument('{{ undefined_var }}');
  const diagnostics = getDiagnostics(doc.uri);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).toContain('undefined_var');
  expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
});
```

## References

- [VS Code Diagnostics API](https://code.visualstudio.com/api/references/vscode-api#Diagnostic)
- [Language Server Diagnostics](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#diagnostic)

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]], [[8 Implement Query Engine]]
