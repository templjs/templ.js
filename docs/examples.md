---
id: examples-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Example Templates
---

This guide now covers the full example pack currently shipped for release readiness work.

## Included Examples

- [markdown-report/](../examples/markdown-report/README.md)
- [html-email/](../examples/html-email/README.md)
- [json-api/](../examples/json-api/README.md)
- [config-files/](../examples/config-files/README.md)
- [documentation/](../examples/documentation/README.md)

## Files in the Examples

### markdown-report/

- [template.md.tmpl](../examples/markdown-report/template.md.tmpl)
- [data.json](../examples/markdown-report/data.json)
- [README.md](../examples/markdown-report/README.md)

### html-email/

- [template.html.tmpl](../examples/html-email/template.html.tmpl)
- [data.json](../examples/html-email/data.json)
- [README.md](../examples/html-email/README.md)

### json-api/

- [template.json.tmpl](../examples/json-api/template.json.tmpl)
- [data.json](../examples/json-api/data.json)
- [README.md](../examples/json-api/README.md)

### config-files/

- [.env.tmpl](../examples/config-files/.env.tmpl)
- [docker-compose.tmpl](../examples/config-files/docker-compose.tmpl)
- [data.json](../examples/config-files/data.json)
- [README.md](../examples/config-files/README.md)

### documentation/

- [template.md.tmpl](../examples/documentation/template.md.tmpl)
- [data.json](../examples/documentation/data.json)
- [README.md](../examples/documentation/README.md)

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
pnpm --filter @templjs/core build
pnpm --filter @templjs/cli build
node src/packages/cli/dist/cli.js render \
  -t examples/markdown-report/template.md.tmpl \
  -i examples/markdown-report/data.json
```

Related source:

- [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts)

## Why These Examples

This pack covers the most representative release-readiness cases:

- Human-readable report generation (Markdown)
- Transactional messaging (HTML)
- Structured response transformation (JSON)
- Deployment-oriented config generation (.env and Docker Compose)
- API-style documentation generation (Markdown)

WI-021 now includes a generated in-repo demo video artifact for review.

## Demo Video

- [templjs-demo.mp4](../assets/demo/templjs-demo.mp4)
- [wi-021-demo-script.md](../assets/demo/wi-021-demo-script.md)
