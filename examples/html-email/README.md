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
pnpm --filter @templjs/cli exec node dist/cli.js render \
  -t examples/html-email/template.html.templ \
  -i examples/html-email/data.json
```

## Purpose

Demonstrates transactional email generation with optional list rendering.
