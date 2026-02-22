---
id: adr-003
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-003: VS Code Architecture (Volar)'
---

## Status

Accepted - February 2026

## Context

The templ.js VS Code extension must provide comprehensive IDE support (diagnostics, completion, hover) while delegating base format linting to VS Code's native language servers.

### Requirements

1. **Full IDE Support**: Syntax highlighting, diagnostics, completion, hover, go-to-definition, formatting
2. **Embedded Language Handling**: Treat templates as "base format + templ DSL overlay"
3. **Incremental Parsing**: Only reparse edited sections for performance
4. **Single Language Stack**: Pure TypeScript (no Python LSP servers)

## Decision

**Adopt Volar framework for VS Code language server implementation.**

### What is Volar?

Volar is a framework for building language servers for **embedded languages** (languages with multiple syntax regions). Originally built for Vue SFC files, it provides:

- **Virtual Code**: Map embedded regions to virtual files for delegation to existing language servers
- **Language Service Plugins**: Extend VS Code's built-in language servers
- **Full IDE Features**: Completion, hover, diagnostics, go-to-definition out of the box

### Architecture

```bash ascii-flow
VS Code
    ↓
Volar Language Server
    ├→ Temple Parser (Chevrotain)
    │   ├→ Virtual Code: Base Format (Markdown/JSON/HTML)
    │   └→ Virtual Code: Temple DSL
    ├→ VS Code JSON Server (for JSON templates)
    ├→ VS Code Markdown Server (for Markdown templates)
    └→ Temple Semantic Analysis (query validation)
```

### Example: `example.md.tmpl`

**Source:**

```markdown
# User Report

{% for user in users %}

- {{ user.name }} ({{ user.email }})
  {% endfor %}
```

**Virtual Code Mapping:**

- Base Markdown (delegated to VS Code Markdown server):

  ```markdown
  # User Report

  **TEMPL_BLOCK**

  - **EXPR** (**EXPR**)
    **TEMPL_BLOCK**
  ```

- Temple DSL (analyzed by Temple semantic engine):

  ```templ
  {% for user in users %}
  {{ user.name }}
  {{ user.email }}
  {% endfor %}
  ```

## Consequences

### Positive

- **Unified TypeScript Stack**: Eliminate Python LSP server
- **Full IDE Features**: Completion, hover, formatting, go-to-definition out of the box
- **Robust Delegation**: Leverages VS Code's battle-tested language servers
- **Simplified Deployment**: Single VS Code extension (no Python runtime required)
- **Incremental Updates**: Volar's virtual code system supports partial file edits
- **Multi-Format Support**: Adding new base formats is straightforward

### Negative

- **Volar Learning Curve**: Team must learn Volar's virtual code system
- **Framework Dependency**: Tied to Volar's release cycle and API stability
- **Initial Implementation Effort**: 2-3 weeks to build Volar plugin + tests

### Neutral

- **Virtual Code Overhead**: Small performance cost for mapping
- **VS Code Specific**: Volar is primarily VS Code-focused

## Performance Targets

- **Initial Parse**: <100ms for 10KB template
- **Incremental Update**: <20ms for single-line edit
- **Completion Latency**: <50ms from keystroke to suggestion
- **Diagnostics Delay**: <200ms from file save to error display

## References

- [Volar.js Documentation](https://volarjs.dev)
- [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- ADR-001: Language Migration
