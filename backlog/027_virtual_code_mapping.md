---
id: wi-027
type: work-item
subtype: task
lifecycle: draft
title: '027: Implement Virtual Code Mapping and Position Tracking'
status: proposed
priority: critical
estimated: 10
assignee: ''
links:
  depends_on:
    - '[[012_volar_plugin]]'
---

## Goal

Build precise virtual code provider with transparent position mapping between original and cleaned templates for accurate diagnostics.

## Background

Volar's virtual code system requires:

1. **Virtual code generation**: Strip template syntax, preserve base format
2. **Position mapping**: Original → cleaned → original for error reporting
3. **Source maps**: Handle multi-line directives correctly

**Related ADRs**: [[ADR-003 VS Code Architecture]]

## Tasks

- [ ] Create `TemplJsVirtualCode` class:
  - `original`: Full template with syntax
  - `cleaned`: Base format without template directives
  - `map`: Line/column position mappings
- [ ] Implement template stripping algorithm:
  - Replace `{% %}` blocks with whitespace
  - Replace `{{ }}` expressions with placeholder vars
  - Replace `{# #}` comments with whitespace
  - Preserve line counts (newlines important)
- [ ] Implement position mapping infrastructure:
  - Track offset mappings (byte positions)
  - Convert between (line, col) coordinate systems
  - Reverse mappings for diagnostic position conversion
- [ ] Handle multi-line edge cases:
  - Directives spanning multiple lines
  - Mixed indentation preservation
  - Windows CRLF vs Unix LF
- [ ] Add source map generation:
  - VLQ encoding for efficient transport
  - Position range tracking for full directives
- [ ] Implement caching for unchanged sections
- [ ] Write 40+ tests for virtual code

## Deliverables

- `TemplJsVirtualCode` class with full mapping
- Position converter utilities
- Source map generator
- 40+ passing tests with edge cases

## Acceptance Criteria

- [ ] Virtual code preserves line count
- [ ] Single-line positions map correctly
- [ ] Multi-line positions map correctly
- [ ] Original → cleaned → original roundtrip accurate
- [ ] Handles CRLF correctly
- [ ] Caching improves performance
- [ ] Diagnostic positions within 1 character accuracy
- [ ] 40+ tests passing

## Example Mapping

**Original**:

```markdown
# Header

{% for user in users %}
Name: {{ user.name }}
{% endfor %}
```

**Cleaned** (sent to Markdown server):

```markdown
# Header

Name:
```

**Position Map**: Tracks original offsets for each cleaned character

## References

- [Volar Virtual Code](https://volarjs.dev/guide/virtual-code)
- [Source Maps (VLQ)](https://docs.google.com/document/d/1U1RGAehQwRypUiFT7kyajEKMCAp1NFdntse6bwGlZfg)

## Dependencies

- Requires: [[5 Implement Chevrotain Lexer]], [[6 Implement Chevrotain Parser]]
- Unblocks: [[14 Implement Diagnostics]]
