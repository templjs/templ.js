---
id: apiref-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Core and CLI API Reference
---

## Status

The APIs documented here are the canonical public surface for the current release train.

{% raw %}

## `@templjs/core`

### Function References

- [String functions](./functions/string-functions.md)
- [Number functions](./functions/number-functions.md)
- [Datetime functions](./functions/datetime-functions.md)
- [Array functions](./functions/array-functions.md)
- [Object functions](./functions/object-functions.md)

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

### [`validateTemplate(template)`](../src/packages/core/src/index.ts#L278)

Validates template syntax and returns `{ valid, syntaxDiagnostics }`.

- `valid`: boolean success flag for the full validation pass
- `syntaxDiagnostics`: ordered lexical/parse/semantic diagnostics for tooling and CLI reporting

- Source: [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L278)
- Examples/Tests: [src/packages/core/test/index.test.ts](../src/packages/core/test/index.test.ts#L116)

```ts
import { validateTemplate } from '@templjs/core';

const result = validateTemplate('{% if user %}Hello{% endif %}');

if (!result.valid) {
  console.log(result.syntaxDiagnostics);
}
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

- Function catalog tests: [src/packages/core/test/query-engine/query-engine.catalog.test.ts](../src/packages/core/test/query-engine/query-engine.catalog.test.ts)

- Source: [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L107)
- Examples/Tests: [src/packages/core/test/index.test.ts](../src/packages/core/test/index.test.ts#L54)

### [`extractTemplateScopeBindings(template)`](../src/packages/core/src/semantic/template-scopes.ts#L266)

Extracts scope-relevant variable bindings for semantic tooling.

- Source: [src/packages/core/src/semantic/template-scopes.ts](../src/packages/core/src/semantic/template-scopes.ts#L266)
- Examples/Tests: [src/packages/core/test/semantic/template-scopes.test.ts](../src/packages/core/test/semantic/template-scopes.test.ts#L39)

## ADRs

- [ADR 010: Diagnostics Terminology and Canonical Schema Sources](./adr/010-diagnostics-terminology-and-canonical-schema-sources.md)
- [ADR 002: Parser Selection](./adr/002-parser-selection.md)
- [ADR 003: VS Code Architecture](./adr/003-vscode-architecture.md)
- [ADR 006: Testing Strategy](./adr/006-testing.md)
- [ADR 008: Context Graph](./adr/008-context-graph.md)

## `@templjs/cli`

### Render

```bash
templjs render -t template.md.tmpl -i data.json
```

Important flags:

- `--watch`
- `--input-format <json|yaml|toml|xml>`
- `--output-format <text|json|html|markdown>`
- `--json`, `--quiet`, `--verbose`
- `--no-validate-input`, `--no-validate-output`

### Validate

```bash
templjs validate -t template.md.tmpl [-s schema.json] [-i data.json]
```

### Init

```bash
templjs init -f markdown [-o starter.md.tmpl]
```

## Stability Notes

- Current package releases are pre-1.0 and move in a shared monorepo release train.
- Public APIs listed above are the recommended integration surface.

{% endraw %}
