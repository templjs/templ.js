---
id: jsonapi-001
type: document
subtype: guide
lifecycle: active
status: ready
title: JSON API Example
summary: Run and understand the JSON API transformation templating example.
---

## Run

```bash
pnpm --filter @templjs/core build
pnpm --filter @templjs/cli build
node src/packages/cli/dist/cli.js render \
  -t examples/json-api/template.json.templ \
  -i examples/json-api/data.json \
  --output-format json
```

## Purpose

Demonstrates JSON-oriented transformation with array iteration.
