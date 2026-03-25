---
id: examples-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Example Templates
---

This release slice includes a reduced, high-value example set from WI-021.

## Included Examples

- [markdown-report/](../examples/markdown-report/README.md)
- [html-email/](../examples/html-email/README.md)
- [json-api/](../examples/json-api/README.md)

## Files in the Examples

### markdown-report/

- [template.md.templ](../examples/markdown-report/template.md.templ)
- [data.json](../examples/markdown-report/data.json)
- [README.md](../examples/markdown-report/README.md)

### html-email/

- [template.html.templ](../examples/html-email/template.html.templ)
- [data.json](../examples/html-email/data.json)
- [README.md](../examples/html-email/README.md)

### json-api/

- [template.json.templ](../examples/json-api/template.json.templ)
- [data.json](../examples/json-api/data.json)
- [README.md](../examples/json-api/README.md)

## Implementation Links

- CLI command registration for `templjs render`: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts)
- CLI render implementation (`renderCommand`): [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts)
- Core rendering API (`renderTemplate`): [src/packages/core/src/index.ts](../src/packages/core/src/index.ts)
- Core renderer internals (`Renderer`): [src/packages/core/src/renderer/renderer.ts](../src/packages/core/src/renderer/renderer.ts)

## ADRs

- [ADR 002: Parser Selection](./adr/002-parser-selection.md)
- [ADR 006: Testing Strategy](./adr/006-testing.md)
- [ADR 007: Syntax Extensibility](./adr/007-syntax-extensibility.md)

## Run an Example

```bash
pnpm --filter @templjs/cli exec node dist/cli.js render \
  -t examples/markdown-report/template.md.templ \
  -i examples/markdown-report/data.json
```

Related source:

- [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts)

## Why This Slice

This reduced set covers the most representative production cases:

- Human-readable report generation (Markdown)
- Transactional messaging (HTML)
- Structured response transformation (JSON)

The full WI-021 scope (additional packs + demo video) can be completed after v1.0 release readiness.
