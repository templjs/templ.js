---
id: documentationexample-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Documentation Example
summary: Generate API-style markdown documentation from structured metadata.
---

## Run

```bash
pnpm --filter @templjs/core build
pnpm --filter @templjs/cli build
node src/packages/cli/dist/cli.js render \
  -t examples/documentation/template.md.templ \
  -i examples/documentation/data.json
```

## Purpose

Demonstrates markdown documentation generation from endpoint-style metadata.

## Data Notes

- `endpoints` drives each section.
- `params` and `responses` show nested list rendering.
- `deprecated` toggles an inline warning note.
