---
id: adr-001
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-001: Language Migration from Python to TypeScript'
---

## Status

Accepted - February 2026

## Context

Temple was initially implemented in Python 3.10+ for rapid prototyping and leveraging Python's rich parsing ecosystem (Lark). However, several factors have emerged that favor migrating to TypeScript:

### Current Pain Points

1. **VS Code Extension Complexity**: The current architecture requires a Python LSP server, Node.js LSP proxy, and virtual document providers, creating a multi-language maintenance burden
2. **Deployment Friction**: End users must install Python runtime + dependencies for the VS Code extension
3. **Browser Support**: Python cannot run in browser environments, limiting use cases (web playgrounds, browser-based editors)
4. **Type Safety Gaps**: Python's gradual typing system (mypy) is less strict than TypeScript's compile-time enforcement
5. **npm Ecosystem**: Template authors expect Node.js tooling (npm packages, bundlers) for integration

### Opportunities with TypeScript

1. **Unified Stack**: Single language for core library, VS Code extension, CLI, and browser bundles
2. **Native VS Code Integration**: TypeScript is VS Code's native language, enabling simpler language server implementations
3. **Performance**: V8/Node.js performance characteristics are well-understood for text processing workloads
4. **Ecosystem Alignment**: npm is the de facto package manager for frontend tooling

### Migration Feasibility

- **Parser Equivalents**: Chevrotain, Nearley, Peggy provide production-grade parsing in TypeScript
- **Test Coverage**: 800+ Python tests provide comprehensive acceptance criteria
- **Architecture Clarity**: Well-documented specifications enable clean-room reimplementation

## Decision

**Full migration to TypeScript with rebrand to `templ.js`.**

### Implementation Approach

1. **Core Library**: Rewrite `temple` package as `@templjs/core` in TypeScript
2. **VS Code Extension**: Migrate to native TypeScript language server (Volar framework)
3. **CLI Tool**: Implement `@templjs/cli` as Node.js binary
4. **Test Parity**: Port all 800+ Python tests to Vitest
5. **Documentation**: Update all docs to reflect TypeScript APIs

### Non-Goals

- No Python version will be maintained long-term (legacy frozen at final Python release)
- No polyglot support (Python bindings, etc.)

## Consequences

### Positive

- **Simplified Architecture**: Eliminates Python runtime dependency for VS Code users
- **Better IDE Support**: TypeScript language server enables full IntelliSense, jump-to-definition, refactoring
- **Browser Compatibility**: Core library can run in browser via Rollup/Webpack bundles
- **Faster Iteration**: Single toolchain (pnpm, tsc, Vitest) reduces context switching
- **Type Safety**: Stricter compile-time guarantees reduce runtime errors
- **Community Alignment**: npm ecosystem is expected by template engine users (Handlebars, Mustache, Nunjucks all use Node.js)

### Negative

- **Learning Curve**: Team must become proficient in TypeScript idioms (generics, mapped types, utility types)
- **Migration Effort**: 6-8 weeks for full rewrite + testing
- **Ecosystem Fragmentation**: Python users lose access to Temple (acceptable trade-off)
- **Performance Unknowns**: TypeScript parser performance must be benchmarked against Python baseline

### Neutral

- **Parser Change**: Moving from Lark (Python) to Chevrotain (TypeScript) requires grammar rewrite (see ADR-002)
- **Package Names**: Rebrand to `templ.js` provides namespace clarity (see ADR-004)
- **Test Infrastructure**: Vitest provides similar ergonomics to Pytest

## References

- Temple Architecture Documentation
- VS Code Extension Architecture
- ADR-002: Parser Technology Selection
- ADR-004: Project Branding
