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

Each folder contains:

- Markdown report template: [markdown-report/template.md.templ](../examples/markdown-report/template.md.templ)
- Markdown report data: [markdown-report/data.json](../examples/markdown-report/data.json)
- Markdown report guide: [markdown-report/README.md](../examples/markdown-report/README.md)
- HTML email template: [html-email/template.html.templ](../examples/html-email/template.html.templ)
- HTML email data: [html-email/data.json](../examples/html-email/data.json)
- HTML email guide: [html-email/README.md](../examples/html-email/README.md)
- JSON API template: [json-api/template.json.templ](../examples/json-api/template.json.templ)
- JSON API data: [json-api/data.json](../examples/json-api/data.json)
- JSON API guide: [json-api/README.md](../examples/json-api/README.md)

## Implementation Links

- CLI command registration for `templjs render`: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts#L223)
- CLI render implementation (`renderCommand`): [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts#L303)
- Core rendering API (`renderTemplate`): [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L155)
- Core renderer internals (`Renderer`): [src/packages/core/src/renderer/renderer.ts](../src/packages/core/src/renderer/renderer.ts#L42)

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
