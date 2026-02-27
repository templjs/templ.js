---
id: wi-012
type: work-item
subtype: story
lifecycle: active
title: '12: Build Volar Language Server Plugin'
status: closed
status_reason: completed
priority: critical
estimated: 14
assignee: ''
actual: 14
completed_date: 2026-02-25
test_results:
  - timestamp: 2026-02-25T09:51:20Z
    note: 'Merged PR #3 and verified Volar plugin build/tests for extension integration.'
commits:
  85c734b: 'Merge pull request #3 from templjs/feature/wi-012-volar-plugin'
links:
  depends_on:
    - '[[005_chevrotain_lexer]]'
    - '[[006_chevrotain_parser]]'
    - '[[007_ast_renderer]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/85c734bf089b15a05420736aa48f5c4380f8504d'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/3'
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

- [x] Extension activates on `.tmpl` files
- [x] Virtual code mapping works correctly
- [x] Base format servers receive delegated documents
- [x] Extension shows no errors on startup
- [x] Basic template file opens without errors
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
