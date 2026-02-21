---
id: adr-007
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-007: Syntax Extensibility and Themes'
---

## Status

Accepted - February 2026

## Context

templ.js must balance two competing requirements:

1. **First Release**: Ship v1.0 with proven, familiar syntax (to maximize adoption)
2. **Long-Term Flexibility**: Support users migrating from other template languages (Jinja2, Liquid, etc.)

The question: Should v1.0 support multiple syntax themes, or commit to a single syntax with plans for v1.1+?

### Syntax Options Evaluated

| Syntax            | Delimiters                  | Familiarity                 | Complexity                      | Users                          |
| ----------------- | --------------------------- | --------------------------- | ------------------------------- | ------------------------------ |
| **Handlebars**    | `{{ }}`, `{{#if}}..{{/if}}` | High (JavaScript ecosystem) | Low (simple, web-native)        | Express.js, Mustache.js, Ember |
| **Jinja2/Liquid** | `{% %}`, `{{ }}`, `{# #}`   | High (Python, Jekyll)       | Medium (tag-based control flow) | Python, Ruby developers        |
| **EJS**           | `<% %>`, `<%= %>`           | Medium (Node.js)            | Low (simple)                    | Node.js developers             |
| **Syntax Themes** | All of above                | Highest (all users)         | Very High (multiple parsers)    | All template users             |

### Complexity Analysis: Multi-Theme Support

To support all three syntaxes in v1.0 would require:

1. **Three Tokenizers** (or parameterized one)
   - Handlebars: `{{ expr }}`
   - Jinja2: `{{ expr }}` + `{% stmt %}`
   - Liquid: `{{ expr }}` + `{% stmt %}` + alternative control blocks

2. **Three Parsers** (or variants)
   - Different token sequences per syntax
   - Different AST structures (if/elif/else vs if/unless vs case statements)
   - Different scoping rules

3. **Renderer Compatibility**
   - Same renderer works for all (AST is independent of syntax) ✓
   - But different node types → different rendering paths

4. **Testing Overhead**
   - 600+ tests × 3 syntaxes = 1,800+ tests
   - 3× QA effort for bug fixes
   - 3× documentation and examples

5. **Maintenance Burden**
   - Bug in tokenizer → fix in 3 places
   - New feature → implement 3 times
   - User confusion: "which syntax should I use?"

**Estimated Impact**: +60-80 hours, +15-20% codebase size, 3× QA overhead

## Decision

**Commit to Handlebars-inspired syntax in v1.0, with architecture designed for v1.1+ multi-theme support.**

### Why Handlebars?

1. **JavaScript Ecosystem**: Handlebars.js has 500k+ weekly npm downloads
2. **Web Developer Familiarity**: Used in Express.js, Ember.js, Mustache.js
3. **Simplicity**: Helper system maps naturally to filters/functions
4. **Documented Philosophy**: "Logic-less templates" aligns with our declarative approach
5. **Proven Track Record**: Battle-tested in production systems

### Why Not Jinja2?

1. **Python-Centric**: Jinja2 users are primarily Python developers; templ.js targets JavaScript users
2. **Complexity**: If/elif/else/endif tag syntax is more verbose than Handlebars blocks
3. **Divergence**: No established Jinja2.js equivalent (EJS is similar but different)

## Architecture: Designed for Future Expansion

The implementation intentionally separates concerns to enable multi-theme support without breaking v1.0:

### Current (v1.0)

```bash ascii-flow
Input Template
    ↓
[Handlebars Tokenizer] (fixed delimiters: {{ }})
    ↓
Token Stream
    ↓
[Chevrotain Parser] (fixed grammar rules)
    ↓
Template AST
    ↓
[Renderer] (universal: works for any syntax)
    ↓
Output
```

### Future (v1.1+)

```bash ascii-flow
Input Template + Syntax Theme
    ↓
[pluggable Tokenizer]
├─ Handlebars Tokenizer
├─ Jinja2/Liquid Tokenizer
└─ User Custom Tokenizer
    ↓
Normalized Token Stream
    ↓
[pluggable Parser]
├─ Handlebars Parser
├─ Jinja2/Liquid Parser
└─ User Custom Parser
    ↓
[Normalized AST]
    ↓
[Universal Renderer] (unchanged)
    ↓
Output
```

### Why This Works

1. **Tokenizer Independence**: Different delimiters/token types don't affect parsing strategy
2. **AST Normalization**: All syntax styles map to same AST structure (NodeType: 'if', 'for', 'let')
3. **Renderer Agnostic**: Renderer neither knows nor cares about source syntax

Example: Both Handlebars and Jinja2 produce equivalent ASTs:

```typescript
// Handlebars: {{#if user.admin}} Admin {{/if}}
// Jinja2: {% if user.admin %} Admin {% endif %}

// Both produce:
{
  type: 'if',
  condition: { type: 'expression', query: 'user.admin' },
  children: [{ type: 'text', content: ' Admin ' }]
}
```

## Implementation Path

### v1.0 (8 weeks)

- ✅ Handlebars tokenizer (fixed delimiters)
- ✅ Chevrotain parser (fixed grammar)
- ✅ Template renderer (universal)
- ✅ CLI with Handlebars syntax
- ✅ VS Code extension for Handlebars

### v1.1 (TBD)

- Create `@templjs/syntax-jinja2` plugin package
- Create `@templjs/syntax-liquid` plugin package
- Add theme selection to CLI: `--syntax=handlebars|jinja2|liquid`
- Add extension settings for syntax preference
- No breaking changes to v1.0 (backward compatible)

### Future

- Support user-defined syntax plugins
- Template format negotiation (detect syntax from delimiters)
- Migration helpers: "convert Jinja2 to Handlebars syntax"

## Consequences

### Positive

1. **Reduced Scope**: v1.0 ships in 8 weeks instead of 12-16 weeks
2. **Quality**: 600 tests instead of 1,800; QA effort is manageable
3. **Clarity**: Single documented syntax, no user confusion
4. **Performance**: One tokenizer/parser = smaller bundle, faster cold start
5. **Focused Adoption**: JavaScript developers see this as "the template engine for npm"
6. **Future-Proof**: v1.1 can add themes without rewriting core

### Negative

1. **Migration Path**: Jinja2 users must translate templates (small group)
2. **Learning Curve**: Python developers must learn Handlebars syntax (mitigated by documentation)
3. **Plugin Complexity**: v1.1 must design plugin system (architecture cost deferred)

### Mitigations

1. **Migration Guide**: Document syntax mapping (Jinja2 → Handlebars) + automated converter tool
2. **Examples**: Show common Jinja2 patterns and Handlebars equivalents
3. **Community**: Announce v1.1 roadmap early to set expectations

## References

- [Handlebars.js](https://handlebarsjs.com/) - Official Handlebars documentation
- [Jinja2 Documentation](https://jinja.palletsprojects.com/) - For syntax comparison
- [Liquid Template Language](https://shopify.github.io/liquid/) - For future multi-theme consideration
- ADR-002: Parser Selection (Chevrotain rationale)
