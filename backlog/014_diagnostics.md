---
id: wi-014
type: work-item
subtype: story
title: '14: Implement Diagnostics (Linting)'
lifecycle: active
status: in-progress
priority: critical
estimated: 10
assignee: ''
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[027_virtual_code_mapping]]'
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

- [ ] Implement diagnostic provider in Volar plugin
- [ ] Detect unclosed template tags
- [ ] Detect undefined variables (from schema)
- [ ] Detect invalid filter usage
- [ ] Collect base format errors from delegated services
- [ ] Map errors back to original positions
- [ ] Generate actionable error messages
- [ ] Test error recovery (continue reporting all errors)
- [ ] Write 30+ tests for diagnostics

## Deliverables

- Diagnostic provider implementation
- Error detection for all error types
- Position mapping for error locations
- 30+ passing tests
- Error message library

## Acceptance Criteria

- [ ] Syntax errors reported immediately
- [ ] Semantic validation (undefined variables)
- [ ] Base format errors appearing in Problems panel
- [ ] Error positions accurate to source
- [ ] Error messages include fixes/suggestions
- [ ] 30+ tests passing
- [ ] <200ms diagnostic latency

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
