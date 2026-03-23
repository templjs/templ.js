---
id: apiref-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Core and CLI API Reference
---

## `@templjs/core`

### `renderTemplate(template, data, options?)`

Renders a template string with structured input data.

```ts
import { renderTemplate } from '@templjs/core';

const result = renderTemplate('Hello {{ user.name }}', {
  user: { name: 'Ada' },
});
```

### `validateTemplate(template)`

Validates template syntax and returns `{ valid, errors? }`.

```ts
import { validateTemplate } from '@templjs/core';

const result = validateTemplate('{% if user %}Hello{% endif %}');
```

### `tokenize(template)` and `parse(tokens)`

Low-level lexer and parser APIs for tooling and diagnostics.

### `SchemaValidator`

Schema-backed data and query-path validation.

```ts
import { SchemaValidator } from '@templjs/core';

const validator = new SchemaValidator({
  type: 'object',
  properties: { user: { type: 'object' } },
});
```

### `createQueryEngine()`

Returns a query engine instance with built-in filter metadata.

### `extractTemplateScopeBindings(template)`

Extracts scope-relevant variable bindings for semantic tooling.

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
