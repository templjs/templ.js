---
id: adr-004
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-004: Branding (templ.js)'
---

## Status

Accepted - February 2026

## Context

The project is undergoing a full rewrite from Python to TypeScript. This presents an opportunity to reconsider the project name and branding.

### Current State

- **Name**: "Temple"
- **Python Package**: `temple` (pip)
- **GitHub**: `squirrel289/temple` repository
- **VS Code Extension**: `vscode-temple-linter`

### Naming Considerations

1. **npm Namespace Collision**: `temple` is a common word, high risk of npm package conflicts
2. **Language Identity**: TypeScript rewrite deserves distinct identity
3. **Search Engine Optimization**: "temple" returns religious content, not templating systems
4. **Community Expectations**: JavaScript template engines often use `.js` suffix (handlebars.js, mustache.js, ejs)

### Candidate Names Evaluated

| Name              | Pros                                              | Cons                                   |
| ----------------- | ------------------------------------------------- | -------------------------------------- |
| **templ.js**      | Clear lineage, `.js` convention, available on npm | Abbreviation may be unclear            |
| **temple-ts**     | Obvious TypeScript identity                       | Less common convention                 |
| **templar**       | Punchy, memorable                                 | New word to learn, potential conflicts |
| **meta-template** | Descriptive                                       | Too generic                            |

## Decision

**Rebrand the project to `templ.js`.**

### Package Naming Convention

1. **Scoped Packages**: Use `@templjs` npm scope
   - `@templjs/core` - Core parser and renderer
   - `@templjs/cli` - Command-line tool
   - `@templjs/volar` - Volar language server plugin
2. **VS Code Extension**: `vscode-templjs`
3. **GitHub Organization**: `templjs/templ.js` (new repository)

### Rationale

1. **npm Availability**: `@templjs` scope is available
2. **Convention Alignment**: Follows `handlebars.js`, `mustache.js` precedent
3. **Clear Lineage**: "templ" maintains connection to "Temple"
4. **TypeScript Identity**: `.js` suffix signals JavaScript/TypeScript ecosystem
5. **SEO**: "templ.js" returns relevant templating results

## Consequences

### Positive

- **Namespace Clarity**: `@templjs` scope avoids conflicts
- **Community Recognition**: `.js` suffix is familiar to JavaScript developers
- **Fresh Start**: New name signals major version change (1.0)
- **Marketing**: Distinct identity from Python version

### Negative

- **Transition Cost**: Update all documentation, links, references
- **Community Fragmentation**: Python users may be confused by rebrand
- **Domain Acquisition**: Need to acquire `templjs.dev` or similar domain

### Neutral

- **Pronunciation**: "temp-el-jay-ess" (4 syllables) vs "temple" (2 syllables)
- **Logo**: Opportunity for new visual identity

## Package Structure

```bash ascii-tree
templjs/templ.js/
├── packages/
│   ├── core/           → @templjs/core
│   ├── cli/            → @templjs/cli
│   └── volar/          → @templjs/volar
└── extensions/
    └── vscode/         → vscode-templjs
```

## File Extensions

- `.tmpl` - Primary template extension (backward compatible)
- `.template` - Alternative extension
- Language-specific: `.md.tmpl`, `.json.tmpl`, `.html.tmpl`

## CLI Command

```bash
# Preferred
templjs render --input data.json --template output.md.tmpl

# Also valid (npm script)
npx @templjs/cli render --input data.json --template output.md.tmpl
```

## Communication Strategy

### Key Messages

1. **To Python Users**: "Temple has graduated to TypeScript as templ.js. Python version is stable but frozen."
2. **To New Users**: "templ.js is a meta-templating system for structured data transformation with IDE support."
3. **To Contributors**: "templ.js is a ground-up TypeScript rewrite with improved architecture and performance."

## References

- [npm Naming Guidelines](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name)
- [VS Code Extension Naming](https://code.visualstudio.com/api/references/extension-manifest)
- [Semantic Versioning](https://semver.org/)
