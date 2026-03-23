---
id: gettingstarted-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Getting Started with templjs
---

## 5-Minute Setup

1. Install prerequisites:
   - Node.js 18+
   - pnpm 8+
2. Clone and install dependencies:

```bash
pnpm install
pnpm build
```

1. Create a template file `hello.md.templ`:

```templ
# Hello {{ user.name }}

Items:
{% for item in items %}
- {{ item }}
{% endfor %}
```

1. Create a data file `data.json`:

```json
{
  "user": { "name": "Ada" },
  "items": ["One", "Two", "Three"]
}
```

1. Render from CLI:

```bash
pnpm --filter @templjs/cli exec node dist/cli.js render -t hello.md.templ -i data.json
```

## Core Library Quick Start

```ts
import { renderTemplate } from '@templjs/core';

const output = renderTemplate('Hello {{ user.name }}', {
  user: { name: 'Ada' },
});

console.log(output);
```

## VS Code Setup

1. Install the templjs VS Code extension package in this repository.
2. Open files with template suffixes:
   - `.md.templ`, `.md.tmpl`, `.md.tpl`
   - `.json.templ`, `.json.tmpl`, `.json.tpl`
   - `.yaml.templ`, `.yaml.tmpl`, `.yaml.tpl`
   - `.html.templ`, `.html.tmpl`, `.html.tpl`
3. Optionally configure schema-aware authoring:

```json
{
  "templjs.schemaPath": ".templjs/frontmatter.schema.json",
  "templjs.contentSchemaPath": ".templjs/content.schema.json",
  "templjs.schemas": {
    "backlog/**": {
      "schemaPath": ".templjs/work-item.frontmatter.schema.json",
      "contentSchemaPath": ".templjs/work-item.content.schema.json"
    }
  }
}
```

## Next Steps

- CLI reference: `docs/cli.md`
- API reference: `docs/api-reference.md`
- Curated examples: `docs/examples.md`
