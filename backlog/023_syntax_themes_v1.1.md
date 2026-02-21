---
id: wi-023
type: work-item
subtype: task
lifecycle: draft
title: '23: Support Alternative Syntax Themes (v1.1)'
status: proposed
priority: medium
estimated: 40
assignee: ''
links:
  depends_on:
    - '[[022_release_v1]]'
---

## Goal

Enable templ.js to support multiple syntax themes (Jinja2, Liquid, etc.) without breaking v1.0 templates or requiring renderer changes.

## Background

v1.0 commits to Handlebars-inspired syntax for fast time-to-market and reduced complexity. However, the architecture is designed to support alternative syntax themes in v1.1+ through pluggable tokenizers and parsers.

This work item captures the design and implementation for multi-theme support.

**Related ADRs**: [[ADR-007 Syntax Extensibility]]

## Architecture

```bash ascii-flow
Input Template + Theme Selection
    ↓
[pluggable Tokenizer]
├─ Handlebars Tokenizer (built-in)
├─ Jinja2/Liquid Tokenizer (plugin)
└─ User Custom Tokenizer
    ↓
Normalized Token Stream
    ↓
[pluggable Parser]
├─ Handlebars Parser (built-in)
├─ Jinja2/Liquid Parser (plugin)
└─ User Custom Parser
    ↓
[Normalized AST] - Same structure regardless of input syntax
    ↓
[Universal Renderer] (unchanged from v1.0)
    ↓
Output
```

## Tasks

### Phase 1: Plugin System (15h)

- [ ] Design plugin architecture for tokenizers and parsers
  - Registry for registering custom tokenizer/parser pairs
  - API for theme detection and selection
  - Validation of plugin interface compliance
- [ ] Create `@templjs/syntax-plugin-api` package
  - Export `TokenizerPlugin` and `ParserPlugin` interfaces
  - Example plugin skeleton with full documentation
- [ ] Create plugin discovery mechanism
  - Auto-load plugins from node_modules (`@templjs/syntax-*`)
  - Manual registration via config or API
  - Plugin versioning and compatibility checks

### Phase 2: Jinja2 Theme Plugin (15h)

- [ ] Create `@templjs/syntax-jinja2` package
  - Tokenizer supporting `{% %}`, `{{ }}`, `{# #}` delimiters
  - Parser supporting Jinja2 control structures:
    - `{% if %}...{% elif %}...{% else %}...{% endif %}`
    - `{% for x in y %}...{% endfor %}`
    - `{% set x = value %}...{% endset %}`
  - AST normalization to standard templ AST
  - 150+ tests (parity with Handlebars coverage)

- [ ] Create migration tool
  - Jinja2 → Handlebars syntax converter
  - Command: `templjs migrate --input old.jinja.tmpl --output new.tmpl --from jinja2 --to handlebars`

### Phase 3: Liquid Theme Plugin (10h)

- [ ] Create `@templjs/syntax-liquid` package
  - Tokenizer for Liquid syntax
  - Parser for Liquid control structures
  - AST normalization
  - 100+ tests

### Integration (5h)

- [ ] CLI support for theme selection
  - `--syntax=handlebars|jinja2|liquid`
  - Auto-detection from delimiters in template
  - Config file support: `"syntax": "jinja2"`

- [ ] VS Code extension support
  - Extension setting for syntax preference
  - File pattern matching for syntax detection
  - Syntax-specific diagnostics and IntelliSense

## Deliverables

- Plugin system design and implementation
- `@templjs/syntax-plugin-api` package
- `@templjs/syntax-jinja2` plugin (full working implementation)
- `@templjs/syntax-liquid` plugin (full working implementation)
- Migration tools (auto-convert between syntaxes)
- 350+ tests (100+ per plugin)
- Documentation for plugin developers

## Acceptance Criteria

- [ ] Plugin system passes all 50+ integration tests
- [ ] Jinja2 plugin passes all 150+ tests
- [ ] Liquid plugin passes all 100+ tests
- [ ] Migration tool converts 100+ test templates without errors
- [ ] CLI auto-detection correctly identifies syntax
- [ ] VS Code extension picks up theme preference
- [ ] No breaking changes to v1.0 Handlebars syntax
- [ ] Plugin documentation allows user-created themes

## Syntax Comparison Table

| Feature        | Handlebars                     | Jinja2                                | Liquid                                |
| -------------- | ------------------------------ | ------------------------------------- | ------------------------------------- |
| **Delimiters** | `{{ }}`                        | `{{ }}`, `{% %}`                      | `{{ }}`, `{% %}`                      |
| **If/else**    | `{{#if}}...{{else}}...{{/if}}` | `{% if %}...{% else %}...{% endif %}` | `{% if %}...{% else %}...{% endif %}` |
| **For loops**  | `{{#for x in y}}...{{/for}}`   | `{% for x in y %}...{% endfor %}`     | `{% for x in y %}...{% endfor %}`     |
| **Comments**   | `{{!-- --}}`                   | `{# #}`                               | `{% comment %}...{% endcomment %}`    |
| **Set/assign** | No direct equivalent           | `{% set x = y %}`                     | `{% assign x = y %}`                  |
| **Filters**    | `{{ x \| filter }}`            | `{{ x \| filter }}`                   | `{{ x \| filter }}`                   |

## Timeline

Estimated v1.1 release: 4-6 weeks post-v1.0

- Week 1: Plugin system design and testing
- Week 2-3: Jinja2 plugin implementation
- Week 4: Liquid plugin + migration tools
- Week 5: Integration testing + documentation
- Week 6: Release v1.1

## Risks and Mitigations

| Risk                                | Likelihood | Impact | Mitigation                                                 |
| ----------------------------------- | ---------- | ------ | ---------------------------------------------------------- |
| Plugin compatibility issues         | Medium     | Medium | Strict interface contracts, automated compatibility checks |
| AST normalization gaps              | Medium     | High   | Comprehensive test suite for each syntax, fuzzing          |
| Users confused by multiple syntaxes | Medium     | Low    | Clear documentation, recommended syntax, examples          |
| Performance regression              | Low        | Medium | Benchmark each plugin, set baseline thresholds             |

## Dependencies

- Requires: v1.0 fully released with stable API
- Unblocks: Multi-language adoption (Python devs using Jinja2, etc.)

## Notes

- This is intentionally deferred to v1.1 to keep v1.0 scope manageable
- Handlebars as v1.0 default allows us to optimize and release faster
- Architecture is designed to accommodate this without rework
- Users are not required to use alternative syntaxes—Handlebars is recommended
