# @templjs/volar

![TemplJS logo](https://raw.githubusercontent.com/templjs/templ.js/refs/heads/staging/assets/templjs.png)

Volar language server plugin for templjs template support in IDEs.

## Overview

This package provides Volar-based language server integration for templjs templates, enabling:

- **Syntax Highlighting**: Proper colorization of template syntax
- **Diagnostics**: Real-time error detection and validation
- **IntelliSense**: Autocompletion and code suggestions
- **Virtual Code Mapping**: Delegates base format features to native language servers

## Architecture

The plugin uses Volar's virtual code system to:

1. Strip template syntax from documents
2. Generate virtual documents in the base format (YAML, JSON, Markdown, etc.)
3. Delegate base format features to VS Code's native language servers
4. Map diagnostics and features back to the original template

## Installation

```bash
pnpm add @templjs/volar
```

## Usage

This package is typically consumed by IDE extensions rather than used directly.

```typescript
import { createTempljsLanguagePlugin } from '@templjs/volar';

const plugin = createTempljsLanguagePlugin();
```

## Status

Implemented in the current monorepo baseline. The package backs the VS Code extension and provides virtual-code mapping, diagnostics, completions, hover, and definition support.

For full project documentation, start at [docs/index.md](../../../docs/index.md).

## License

Apache-2.0
