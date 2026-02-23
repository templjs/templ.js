# @templjs/core

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
import { createLexer, createParser, createRenderer } from '@templjs/core';

// Example usage (to be implemented)
const lexer = createLexer();
const parser = createParser();
const renderer = createRenderer();
```

## Status

🚧 **Under Development** - This package is part of the initial monorepo setup and core functionality is being implemented.

## License

Apache-2.0
