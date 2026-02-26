---
id: wi-015
type: work-item
subtype: story
title: '15: Implement IntelliSense (Completion, Hover, Go-to-Definition)'
lifecycle: active
status: closed
status_reason: completed
priority: critical
estimated: 12
assignee: ''
actual: 12
completed_date: 2026-02-25
test_results:
  - timestamp: 2026-02-25T17:42:22Z
    note: 'Merged PR #6 with completion/hover/definition providers and passing tests.'
commits:
  fb2ef49: 'Merge pull request #6 from templjs/feature/wi-015-intellisense'
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[027_virtual_code_mapping]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/fb2ef490c41681f2a3fce5cbf542d0fdfdd8834d'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/6'
---

## Goal

Provide intelligent code completion, hover documentation, and navigation features.

## Background

IntelliSense features:

- **Completion**: Suggest variable names, filters, keywords
- **Hover**: Show variable types, function signatures
- **Go-to-Definition**: Jump to schema/template definitions
- **Parameter Hints**: Show function argument info
- **Signature Help**: Function parameter hints

**Related ADRs**: [[ADR-003 VS Code Architecture]]

## Tasks

- [x] Implement completion provider
- [x] Add variable name completion from data schema
- [x] Add filter completion (built-in and custom)
- [x] Add keyword completion (if, for, end\*, etc.)
- [x] Implement hover provider
- [x] Show type information on hover
- [x] Implement go-to-definition provider
- [x] Support jump to schema definitions
- [x] Add signature help for functions
- [x] Write 20+ tests for IntelliSense

## Deliverables

- Completion provider with filtering
- Hover provider with type info
- Go-to-definition provider
- Signature help provider
- 20+ passing tests

## Acceptance Criteria

- [x] Completion shows variables from data
- [x] Completion shows filters with docs
- [x] Hover shows variable types
- [x] Hover shows filter documentation
- [x] Go-to-definition works
- [x] 20+ tests passing
- [x] <50ms completion latency

## Example Interactions

### Completion

```pseudo-ux
Type: << us|<trigger>
Suggestions:
  - user (type: object)
  - users (type: array)
```

### Hover

```pseudo:ux
<< user.| <hover>
Shows: user
  {
    name: string
    email: string
    age: number
  }
```

### Go-to-Definition

```pseudo:ux
<< user.<click> → Opens schema file, jumps to 'user' definition
```

## Completion Items

```typescript
{
  label: 'user',
  kind: CompletionItemKind.Variable,
  detail: 'type: object',
  documentation: 'Current user object'
}
```

## References

- [VS Code Completion API](https://code.visualstudio.com/api/references/vscode-api#CompletionProvider)
- [Hover Provider](https://code.visualstudio.com/api/references/vscode-api#HoverProvider)
- [Definition Provider](https://code.visualstudio.com/api/references/vscode-api#DefinitionProvider)

## Dependencies

- Requires: [[8 Implement Query Engine]], [[14 Implement Diagnostics]]
