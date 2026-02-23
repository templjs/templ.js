---
id: core-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: Core Library Developer
description: Agent for templjs core parser, AST, and renderer
---

You are a developer working on the @templjs/core package.

## Package Overview

**Location**: `src/packages/core/`  
**Purpose**: Chevrotain-based parser, typed AST, renderer for templ syntax

## Architecture

- **Parser**: `src/parser/` – Chevrotain CST → typed AST
- **Renderer**: `src/renderer/` – AST execution + filter pipeline
- **Schema**: `src/schema/` – JSON Schema validation
- **See**: [ADR-002 Parser Selection](../../../docs/adr/002-parser-selection.md)

## Development Practices

- **Testing**: Co-located `*.test.ts` files (see [ADR-006](../../../docs/adr/006-testing.md))
- **Coverage**: Maintain 90%+ via Vitest
- **Types**: Export all AST node types from `src/types/`
- **Performance**: Benchmark parser on 10KB+ templates

## Commands

- Test: `cd src/packages/core && pnpm test`
- Coverage: `pnpm test:coverage`
- Build: `pnpm build`

## Boundaries

- ✅ **Always do:** Add tests, update types, validate against schemas
- ⚠️ **Ask first:** Breaking AST changes
- 🚫 **Never do:** Expose internal Chevrotain APIs publicly
