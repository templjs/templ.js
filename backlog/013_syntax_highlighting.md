---
id: wi-013
type: work-item
subtype: story
lifecycle: draft
title: '13: Implement Syntax Highlighting and Semantic Tokens'
status: proposed
priority: critical
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[027_virtual_code_mapping]]'
---

## Goal

Provide syntax highlighting for template syntax with semantic tokens for IDE accuracy.

## Background

Syntax highlighting differentiates template syntax from base format:

- Template statements: `{% if %}` in blue
- Expressions: `{{ var }}` in green
- Comments: `{# comment #}` in gray
- Base format: Normal styling

**Related ADRs**: [[ADR-003 VS Code Architecture]]

## Tasks

- [ ] Create TextMate grammar for template syntax
- [ ] Define token scopes for VS Code themes
- [ ] Implement semantic token provider
- [ ] Color statements, expressions, comments differently
- [ ] Map tokens to VS Code token types
- [ ] Test with light and dark themes
- [ ] Support custom delimiter themes
- [ ] Write 20+ tests for highlighting

## Deliverables

- TextMate grammar file
- Semantic token provider
- Theme compatibility verification
- 20+ passing tests

## Acceptance Criteria

- [ ] Statements highlighted correctly
- [ ] Expressions highlighted correctly
- [ ] Comments highlighted correctly
- [ ] Theme-aware colors applied
- [ ] Works with dark and light themes
- [ ] Custom delimiters respected

## Token Types

- **Keywords**: if, for, block, set, endif, endfor, endblock
- **Variables**: user, items, user.name
- **Filters**: upper, lower, escape, default
- **Strings**: Content inside delimiters
- **Comments**: Ignored sections

## Configuration

```json
{
  "languages": [
    {
      "id": "templated-markdown",
      "extensions": [".md.tmpl"],
      "configuration": "./language-configuration.json"
    }
  ],
  "grammars": [
    {
      "language": "templated-markdown",
      "scopeName": "text.html.markdown.templated",
      "path": "./syntaxes/templ.tmLanguage.json"
    }
  ]
}
```

## References

- [VS Code TextMate Grammar](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- [Semantic Tokens](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)

## Dependencies

- Requires: [[12 Build Volar Language Server Plugin]]
