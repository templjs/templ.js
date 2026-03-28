---
id: configfiles-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Config Files Example
summary: Render environment and container configuration files from shared structured input.
---

## Run

```bash
pnpm --filter @templjs/core build
pnpm --filter @templjs/cli build
node src/packages/cli/dist/cli.js render \
  -t examples/config-files/.env.tmpl \
  -i examples/config-files/data.json

node src/packages/cli/dist/cli.js render \
  -t examples/config-files/docker-compose.tmpl \
  -i examples/config-files/data.json
```

## Purpose

Demonstrates generating multiple deployment-oriented config files from one source of truth.

## Data Notes

- `app.env_entries` is rendered as flat key/value pairs.
- `services` drives the generated Docker Compose service blocks.
- `depends_on` is optional per service.
