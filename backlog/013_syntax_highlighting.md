---
id: wi-013
type: work-item
subtype: story
title: '13: Implement Syntax Highlighting and Semantic Tokens'
lifecycle: active
status: ready-for-review
status_reason: tests-passing
priority: critical
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[027_virtual_code_mapping]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/8'
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

- [x] Create TextMate grammar for template syntax
- [x] Define token scopes for VS Code themes
- [x] Implement semantic token provider
- [x] Color statements, expressions, comments differently
- [x] Map tokens to VS Code token types
- [x] Test with light and dark themes
- [x] Support custom delimiter themes
- [x] Write 20+ tests for highlighting

## Deliverables

- TextMate grammar file
- Semantic token provider
- Theme compatibility verification
- 20+ passing tests

## Acceptance Criteria

- [x] Statements highlighted correctly
- [x] Expressions highlighted correctly
- [x] Comments highlighted correctly
- [x] Theme-aware colors applied
- [x] Works with dark and light themes
- [x] Custom delimiters respected

## Token Types

- **Keywords**: if, for, block, set, endif, endfor, endblock
- **Variables**: user, items, user.name
- **Filters**: upper, lower, escape, default
- **Strings**: Content inside delimiters
- **Comments**: Ignored sections

## Validation Evidence

- `pnpm --filter @templjs/volar test` (102 passing tests)
- `pnpm --filter @templjs/volar build`

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
