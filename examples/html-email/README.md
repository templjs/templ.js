# HTML Email Example

## Run

```bash
pnpm --filter @templjs/cli exec node dist/cli.js render \
  -t examples/html-email/template.html.templ \
  -i examples/html-email/data.json
```

## Purpose

Demonstrates transactional email generation with optional list rendering.
