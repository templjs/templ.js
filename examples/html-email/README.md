---
id: htmlemail-001
type: document
subtype: guide
lifecycle: active
status: ready
title: HTML Email Example
summary: Run and understand the transactional HTML email templating example.
---

## Run

```bash
pnpm --filter @templjs/core build
pnpm --filter @templjs/cli build
node src/packages/cli/dist/cli.js render \
  -t examples/html-email/template.html.templ \
  -i examples/html-email/data.json
```

## Purpose

Demonstrates transactional email generation with optional list rendering.

## Data Notes

- `order.total` must be numeric.
- `order.currency_code` must be an ISO 4217 code (for example `USD`, `EUR`).
- `order.locale` must be a BCP 47 locale string (for example `en-US`, `de-DE`).
