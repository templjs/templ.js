# JSON API Example

## Run

```bash
pnpm --filter @templjs/cli exec node dist/cli.js render \
  -t examples/json-api/template.json.templ \
  -i examples/json-api/data.json \
  --output-format json
```

## Purpose

Demonstrates JSON-oriented transformation with array iteration.
