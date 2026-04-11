---
id: gettingstarted-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Getting Started with templjs
---

{% raw %}

## 5-Minute Setup

1. Install prerequisites:
   - Node.js 22.12+ or 24.x
   - pnpm 8.15.0
2. Clone and install dependencies:

   ```bash
   corepack enable
   corepack prepare pnpm@8.15.0 --activate
   pnpm install
   pnpm build
   ```

3. Create a template file `hello.md.templ`:

   ```templ
   # Hello {{ user.name }}

   Items:
   {% for item in items %}
   - {{ item }}
   {% endfor %}
   ```

4. Create a data file `data.json`:

   ```json
   {
     "user": { "name": "Ada" },
     "items": ["One", "Two", "Three"]
   }
   ```

5. Render from CLI:

   From monorepo root (development):

   ```bash
   node src/packages/cli/dist/cli.js render -t hello.md.templ -i data.json
   ```

   After publishing (end users):

   ```bash
   npx @templjs/cli render -t hello.md.templ -i data.json
   ```

## Core Library Quick Start

```ts
import { renderTemplate } from '@templjs/core';

const output = renderTemplate('Hello {{ user.name }}', {
  user: { name: 'Ada' },
});

console.log(output);
```

## Architecture & Source

Design context (ADRs):

- [ADR 001: Language Migration](./adr/001-language-migration.md)
- [ADR 002: Parser Selection](./adr/002-parser-selection.md)
- [ADR 005: Monorepo](./adr/005-monorepo.md)

Implementation references:

- Core quick-start API export `renderTemplate`: [src/packages/core/src/index.ts](../src/packages/core/src/index.ts#L155)
- CLI entrypoint (`templjs render` wiring): [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts#L223)
- CLI command export `renderCommand`: [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts#L303)
- CLI command export `validateCommand`: [src/packages/cli/src/commands/validate.ts](../src/packages/cli/src/commands/validate.ts#L15)
- CLI command export `initCommand`: [src/packages/cli/src/commands/init.ts](../src/packages/cli/src/commands/init.ts#L20)

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

- CLI reference: [cli.md](./cli.md)
- API reference: [api-reference.md](./api-reference.md)
- Curated examples: [examples.md](./examples.md)

{% endraw %}
