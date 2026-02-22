---
id: wi-015
type: work-item
subtype: story
lifecycle: draft
title: '15: Implement IntelliSense (Completion, Hover, Go-to-Definition)'
status: proposed
priority: critical
estimated: 12
assignee: ''
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[027_virtual_code_mapping]]'
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

- [ ] Implement completion provider
- [ ] Add variable name completion from data schema
- [ ] Add filter completion (built-in and custom)
- [ ] Add keyword completion (if, for, end\*, etc.)
- [ ] Implement hover provider
- [ ] Show type information on hover
- [ ] Implement go-to-definition provider
- [ ] Support jump to schema definitions
- [ ] Add signature help for functions
- [ ] Write 20+ tests for IntelliSense

## Deliverables

- Completion provider with filtering
- Hover provider with type info
- Go-to-definition provider
- Signature help provider
- 20+ passing tests

## Acceptance Criteria

- [ ] Completion shows variables from data
- [ ] Completion shows filters with docs
- [ ] Hover shows variable types
- [ ] Hover shows filter documentation
- [ ] Go-to-definition works
- [ ] 20+ tests passing
- [ ] <50ms completion latency

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
