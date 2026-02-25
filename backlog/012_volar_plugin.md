---
id: wi-012
type: work-item
subtype: story
lifecycle: active
title: '12: Build Volar Language Server Plugin'
status: in-progress
priority: critical
estimated: 14
assignee: ''
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
    - '[[006_chevrotain_parser]]'
    - '[[007_ast_renderer]]'
---

## Goal

Implement Volar framework integration for full IDE support in VS Code.

## Background

Volar provides language server plugin architecture for embedded languages. Handles:

- Virtual code mapping (base format → language server delegation)
- Semantic analysis (template-specific validation)
- IDE feature coordination (completion, hover, etc.)

**Related ADRs**: [[ADR-003 VS Code Architecture]]

## Tasks

- [x] Fix `packages/volar/src/index.ts`: Remove eslint-disable directive and properly type parameters (remove `/* eslint-disable ... */` comment and fix Volar API type mismatches with proper parameter typing)
- [x] Create `packages/volar/src/` directory structure
- [x] Implement Volar language service plugin in TypeScript
- [x] Setup virtual code provider for base format delegation
- [x] Implement code mapping (template → virtual documents)
- [x] Add language service initialization
- [x] Create `extensions/vscode/src/extension.ts` main entry
- [x] Configure VS Code extension manifest (`package.json`)
- [x] Setup language configuration (`language-configuration.json`)
- [x] Write integration tests (30+ tests)
- [x] Test with sample templates

## Deliverables

- Volar plugin implementation
- VS Code extension entry point
- Language configuration
- 30+ passing integration tests
- Sample template files

## Acceptance Criteria

- [ ] Extension activates on `.tmpl` files
- [ ] Virtual code mapping works correctly
- [ ] Base format servers receive delegated documents
- [ ] Extension shows no errors on startup
- [ ] Basic template file opens without errors
- [x] 30+ tests passing

## Virtual Code Example

**Template**: `example.md.tmpl`

```markdown
# Report

{% for user in users %}

- {{ user.name }}
  {% endfor %}
```

**Virtual Code (Markdown delegation)**:

```markdown
# Report

<!-- templ block: stripped for markdown linting -->

- <!-- templ expression -->
<!-- end templ block -->
```

## References

- ADR-003: VS Code Architecture
- [Volar Documentation](https://volarjs.dev)
- [VS Code Language Server Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]], [[6 Implement Chevrotain Parser]]
- Parallel with: [[13 Implement Syntax Highlighting]]
