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

- `examples/markdown-report/`
- `examples/html-email/`
- `examples/json-api/`

Each folder contains:

- `template.*.templ`: template source
- `data.json`: input payload
- `README.md`: run instructions and expected output shape

## Run an Example

```bash
pnpm --filter @templjs/cli exec node dist/cli.js render \
  -t examples/markdown-report/template.md.templ \
  -i examples/markdown-report/data.json
```

## Why This Slice

This reduced set covers the most representative production cases:

- Human-readable report generation (Markdown)
- Transactional messaging (HTML)
- Structured response transformation (JSON)

The full WI-021 scope (additional packs + demo video) can be completed after v1.0 release readiness.
