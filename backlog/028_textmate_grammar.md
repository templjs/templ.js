---
id: wi-028
type: work-item
subtype: task
title: '028: Implement TextMate Grammar with Embedded Language Support'
lifecycle: active
status: ready
priority: critical
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
---

## Goal

Create TextMate grammar supporting syntax highlighting for template syntax AND embedded base language grammars (Markdown, HTML, JSON, YAML).

## Background

TextMate grammars provide initial colorization while language servers load. Must:

1. Highlight template syntax (keywords, delimiters, variables)
2. Embed base language grammars between template blocks
3. Support multiple themes (Dark+, Monokai, Solarized)

**Related ADRs**: [[ADR-003 VS Code Architecture]]

## Tasks

- [ ] Create `packages/volar/syntaxes/` directory
- [ ] Generate base grammar file: `templjs.tmLanguage.json`
  - Define token patterns for delimiters: `{% %}`, `{{ }}`
  - Keywords: `if`, `for`, `endif`, `endfor`, `block`, `include`, `set`
  - Variables: Dot notation, array access
  - Filters: `| upper`, `| default(...)`
  - Comments: `{# #}`
- [ ] Implement embedded language injection:
  - Detect base format from file extension: `.md.tmpl` → markdown
  - Inject base language grammar between template directives
  - Include rules for markdown, HTML, JSON, YAML
- [ ] Create injection grammar files: `injection-<lang>.json`
- [ ] Define scope selectors for token types:
  - `punctuation.definition.template` → template delimiters
  - `keyword.control.template` → if/for keywords
  - `variable.other.template` → variable names
  - `support.function.template` → filters
  - `comment.block.template` → comments
- [ ] Test with multiple themes:
  - Visual Studio Dark+ (default)
  - Monokai
  - Solarized Dark
  - One Dark Pro
- [ ] Write 20+ theme compatibility tests
- [ ] Validate grammar with online TextMate validator

## Deliverables

- `templjs.tmLanguage.json` main grammar
- `injection-markdown.json`, `injection-html.json`, `injection-json.json`, `injection-yaml.json`
- Theme test suite
- 20+ passing validation tests

## Acceptance Criteria

- [ ] Template delimiters highlighted distinctly
- [ ] Keywords colored as control flow
- [ ] Variables colored as identifiers
- [ ] Filters colored as functions
- [ ] Comments grayed out
- [ ] Base language syntax preserved between templates
- [ ] Works with Dark+, Monokai, Solarized themes
- [ ] Grammar validates with no errors

## Scope Selector Reference

```json
{
  "name": "TemplJS",
  "scopeName": "source.templjs",
  "patterns": [
    {
      "include": "#statement"
    },
    {
      "include": "#expression"
    }
  ],
  "repository": {
    "statement": {
      "begin": "\\{%",
      "end": "%\\}",
      "name": "meta.block.templjs",
      "patterns": [
        {
          "match": "\\b(if|for|block|endif|endfor|endblock)\\b",
          "name": "keyword.control.templjs"
        }
      ]
    }
  }
}
```

## References

- [TextMate Grammar Reference](https://macromates.com/manual/en/language_grammars)
- [VS Code Syntax Highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- [Language Injection](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars)

## Dependencies

- Requires: [[12 Build Volar Language Server Plugin]]
- Parallel with: [[14 Implement Diagnostics]]
