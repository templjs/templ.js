---
id: apiref-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Core and CLI API Reference
---

## `@templjs/core`

### [`renderTemplate(template, data, options?)`](../src/packages/core/src/index.ts#L155)

Renders a template string with structured input data.

- Source: [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L155)
- Examples/Tests: [src/packages/core/test/index.test.ts](../src/packages/core/test/index.test.ts#L79)

```ts
import { renderTemplate } from '@templjs/core';

const result = renderTemplate('Hello {{ user.name }}', {
  user: { name: 'Ada' },
});
```

### [`validateTemplate(template)`](../src/packages/core/src/index.ts#L202)

Validates template syntax and returns `{ valid, errors? }`.

- Source: [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L202)
- Examples/Tests: [src/packages/core/test/index.test.ts](../src/packages/core/test/index.test.ts#L101)

```ts
import { validateTemplate } from '@templjs/core';

const result = validateTemplate('{% if user %}Hello{% endif %}');
```

### [`tokenize(template)`](../src/packages/core/src/lexer/lexer.ts#L21) and [`parse(tokens)`](../src/packages/core/src/parser/parser.ts#L871)

Low-level lexer and parser APIs for tooling and diagnostics.

- Source: [src/packages/core/src/lexer/lexer.ts](../src/packages/core/src/lexer/lexer.ts#L21), [src/packages/core/src/parser/parser.ts](../src/packages/core/src/parser/parser.ts#L871)
- Examples/Tests: [src/packages/core/test/lexer/lexer.test.ts](../src/packages/core/test/lexer/lexer.test.ts#L1), [src/packages/core/test/parser/parser.test.ts](../src/packages/core/test/parser/parser.test.ts#L1)

### [`SchemaValidator`](../src/packages/core/src/schema/SchemaValidator.ts#L15)

Schema-backed data and query-path validation.

- Source: [src/packages/core/src/schema/SchemaValidator.ts](../src/packages/core/src/schema/SchemaValidator.ts#L15)
- Examples/Tests: [src/packages/core/test/schema/SchemaValidator.test.ts](../src/packages/core/test/schema/SchemaValidator.test.ts#L22)

```ts
import { SchemaValidator } from '@templjs/core';

const validator = new SchemaValidator({
  type: 'object',
  properties: { user: { type: 'object' } },
});
```

### [`createQueryEngine()`](../src/packages/core/src/index.ts#L107)

Returns a query engine instance with built-in filter metadata.

- Source: [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L107)
- Examples/Tests: [src/packages/core/test/index.test.ts](../src/packages/core/test/index.test.ts#L54)

### [`extractTemplateScopeBindings(template)`](../src/packages/core/src/semantic/template-scopes.ts#L266)

Extracts scope-relevant variable bindings for semantic tooling.

- Source: [src/packages/core/src/semantic/template-scopes.ts](../src/packages/core/src/semantic/template-scopes.ts#L266)
- Examples/Tests: [src/packages/core/test/semantic/template-scopes.test.ts](../src/packages/core/test/semantic/template-scopes.test.ts#L39)

## ADRs

- [ADR 001: Language Migration](./adr/001-language-migration.md)
- [ADR 002: Parser Selection](./adr/002-parser-selection.md)
- [ADR 003: VS Code Architecture](./adr/003-vscode-architecture.md)
- [ADR 006: Testing Strategy](./adr/006-testing.md)
- [ADR 008: Context Graph](./adr/008-context-graph.md)

## `@templjs/cli`

### Render

```bash
templjs render -t template.md.templ -i data.json
```

Important flags:

- `--watch`
- `--input-format <json|yaml|toml|xml>`
- `--output-format <text|json|html|markdown>`
- `--json`, `--quiet`, `--verbose`
- `--no-validate-input`, `--no-validate-output`

### Validate

```bash
templjs validate -t template.md.templ [-s schema.json] [-i data.json]
```

### Init

```bash
templjs init -f markdown [-o starter.md.templ]
```

## Stability Notes

- Current package versions in this repo are pre-1.0 (`0.1.0`).
- Public APIs listed above are the recommended integration surface.
