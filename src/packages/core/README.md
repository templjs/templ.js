# @templjs/core

![TemplJS logo](https://raw.githubusercontent.com/templjs/templ.js/refs/heads/staging/assets/templjs.png)

Core template parser, renderer, and query engine for the templjs meta-templating system.

## Overview

This package provides the foundational components for templjs:

- **Lexer**: Tokenizes template syntax
- **Parser**: Builds an Abstract Syntax Tree (AST) from tokens
- **Renderer**: Generates output from AST and data
- **Query Engine**: Extracts and transforms structured data

## Installation

```bash
pnpm add @templjs/core
```

## Usage

```typescript
import { render, tokenize, parse } from '@templjs/core';

const template = 'Hello {{ user.name }}';
const output = render(template, { user: { name: 'Ada' } });
const tokens = tokenize(template);
const ast = parse(tokens);

console.log(output, ast.errors.length);
```

## Status

Implemented in the current monorepo baseline, with public APIs continuing to stabilize. See [README.md](../../../README.md) and [docs/api-reference.md](../../../docs/api-reference.md) for current surface area.

For full project documentation, start at [docs/index.md](../../../docs/index.md).

## License

Apache-2.0
