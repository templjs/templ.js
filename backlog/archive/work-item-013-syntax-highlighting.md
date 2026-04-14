---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:013-syntax-highlighting
title: '13: Implement Syntax Highlighting and Semantic Tokens'
summary: Implement Syntax Highlighting and Semantic Tokens
type: work-item
subtype: story
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 8
actual: 8
commits:
  ed60918: 'Merge pull request #8 from templjs/feature/wi-013-syntax-highlighting'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/8
  evidence:
    - '[[record-013-syntax-highlighting-evidence-1]]'
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

## Relationships

- `depends_on`: [[work-item-012-volar-plugin]]
- `depends_on`: [[work-item-027-virtual-code-mapping]]
