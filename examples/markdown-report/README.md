---
id: mdreport-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Markdown Report Example
summary: Run and understand the markdown report templating example.
---

## Markdown Report Example

## Run

```bash
node examples/markdown-report/validate-data.mjs && \
pnpm --filter @templjs/cli exec node dist/cli.js render \
  -t examples/markdown-report/template.md.templ \
  -i examples/markdown-report/data.json
```

## Purpose

Demonstrates report generation with loops and conditional blocks.

## Data Contract

- `active_users_by_region` lists the regional active-user counts that contribute to `kpi.active_users_30d`.
- The sample data currently sums to the same value as `kpi.active_users_30d`.
