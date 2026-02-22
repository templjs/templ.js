---
id: adr-002
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-002: Parser Selection (Chevrotain)'
---

## Status

Accepted - February 2026

## Context

The Temple DSL requires a production-grade parser capable of:

1. **Configurable Delimiters**: Support `{% %}`, `{{ }}`, `{# #}` with user-configurable alternatives
2. **Positional Accuracy**: Track exact line/column positions for error reporting
3. **Incremental Parsing**: Support LSP use cases (partial file edits)
4. **Embedded Languages**: Distinguish template syntax from base format (Markdown, JSON, HTML)
5. **Error Recovery**: Best-effort parsing with actionable error messages

### Parser Options Evaluated

| Parser         | Language       | Approach                 | Type Safety           | Performance        | Ecosystem                     |
| -------------- | -------------- | ------------------------ | --------------------- | ------------------ | ----------------------------- |
| **Chevrotain** | TypeScript     | Code-based (Combinators) | Excellent (TS native) | High (benchmarked) | Active, well-maintained       |
| **Nearley**    | JavaScript     | Grammar (BNF)            | Good (TS definitions) | Moderate           | Stable, less active           |
| **Peggy**      | JavaScript     | PEG grammar              | Good (generated code) | High               | Active (Peg.js fork)          |
| **ANTLR4**     | Multi-language | Grammar (ANTLR)          | Good (generated TS)   | High               | Large ecosystem, Java-centric |
| **Lark.js**    | JavaScript     | Grammar (Lark port)      | Poor (JS only)        | Unknown            | Port, not mature              |

### Detailed Analysis

#### Chevrotain

**Pros:**

- Pure TypeScript, zero dependencies
- Code-based grammar (no build step)
- Excellent error recovery and reporting
- Built-in support for token position tracking
- First-class TypeScript types for AST
- Active maintenance (SAP-backed)
- Benchmarks show 2-3x faster than ANTLR4

**Cons:**

- Steeper learning curve than declarative grammar formats
- Must write grammar as TypeScript code (not separate .grammar file)

## Decision

**Chevrotain as the primary parser for templ.js.**

### Rationale

1. **TypeScript-First**: Code-based grammar provides full type safety and IDE support
2. **Zero Build Step**: No grammar compilation means faster iteration
3. **Performance**: Benchmarks show Chevrotain matches or exceeds alternatives
4. **Error Recovery**: Built-in mechanisms for fault-tolerant parsing (critical for LSP)
5. **Position Tracking**: First-class support for line/column tracking
6. **Maintenance**: Well-documented, actively maintained, used in production (Monaco Editor)

### Implementation Plan

1. **Tokenizer**: Use Chevrotain's `Lexer` class with configurable delimiter patterns
2. **Parser**: Use Chevrotain's `CstParser` (Concrete Syntax Tree) for maximum flexibility
3. **AST Transformation**: Post-process CST to Temple AST format
4. **Error Reporting**: Leverage Chevrotain's error recovery for partial parses

## Consequences

### Positive

- **Type Safety**: Grammar rules are TypeScript functions with full type inference
- **IDE Support**: Grammar authoring gets IntelliSense, refactoring, jump-to-definition
- **Performance**: No grammar compilation step speeds up CI/CD
- **Debugging**: Standard TypeScript debugging tools work directly on grammar code
- **Incremental Parsing**: Chevrotain supports re-parsing subsets of input (LSP-friendly)

### Negative

- **Learning Curve**: Team must learn Chevrotain's combinator API (not traditional BNF)
- **Grammar Verbosity**: Code-based grammars are more verbose than declarative formats
- **Tooling Gap**: No grammar visualization tools (unlike ANTLR4's railroad diagrams)

### Neutral

- **Grammar Migration**: Lark grammar must be manually ported to Chevrotain rules
- **Testing**: Grammar tests become TypeScript unit tests (Vitest-compatible)

## Performance Targets

- **Tokenization**: <1ms for 4KB template
- **Parsing**: <5ms for 4KB template with 100 tokens
- **Error Recovery**: <10ms for malformed 4KB template

## References

- [Chevrotain Documentation](https://chevrotain.io)
- [Chevrotain Performance Guide](https://chevrotain.io/docs/guide/performance.html)
- [Temple Syntax Specification](../../../temple/temple/docs/ARCHITECTURE.md)
