# vscode-templjs

VS Code extension for templjs meta-template language support.

## Features

- **Syntax Highlighting**: Proper colorization of template directives and expressions
- **Diagnostics**: Real-time error detection and validation
- **IntelliSense**: Autocompletion for template syntax and data paths
- **Virtual Code Mapping**: Seamless integration with base format language servers

## Supported File Extensions

- `.yaml.templ` / `.yml.templ` / `.yaml.tmpl` / `.yml.tmpl` / `.yaml.tpl` / `.yml.tpl` - YAML templates
- `.json.templ` / `.json.tmpl` / `.json.tpl` - JSON templates
- `.md.templ` / `.md.tmpl` / `.md.tpl` - Markdown templates
- `.html.templ` / `.html.tmpl` / `.html.tpl` - HTML templates
- `.xml.templ` / `.xml.tmpl` / `.xml.tpl` - XML templates

## Architecture

This extension uses Volar language server to provide IDE features:

1. **Template Processing**: Strips template syntax from documents
2. **Virtual Documents**: Creates virtual documents in base format
3. **Feature Delegation**: Delegates base format features to VS Code's native servers
4. **Mapping**: Maps diagnostics and completions back to original template

## Configuration

```json
{
  "templjs.trace.server": "off", // or "messages" or "verbose"
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

Schema precedence is resolved per document as:

1. Inline directives (`{{# schema: ... }}` / `{{# content-schema: ... }}`)
2. Root/frontmatter aliases (`$templ-schema`, `$content-schema`)
3. Workspace settings (`templjs.schemas`, `templjs.schemaPath`, `templjs.contentSchemaPath`)

When schema files change on disk (`.json`, `.yaml`, `.yml`), the server invalidates its schema cache and refreshes diagnostics for open templjs documents.

## Triage Logs

### Configure logging

1. Set `templjs.trace.server` to `messages` (or `verbose` for extra detail).
2. Open the output panel and select the **templjs** channel.
3. Reproduce the issue once to capture a clean log sequence.

### What to look for

- **Go-to-definition (no result or wrong file)**
  - Check `definition requested` and `definition result` lines.
  - Confirm resolver path: `resolved via path value`, `resolved via schema path token`, or `resolved via provider`.
  - If range mapping looks wrong, check `definition range resolver fallback` / `definition range resolver failed`.

- **Hover (missing or incomplete description)**
  - Check `hover requested` and `hover result=none|present`.
  - Look for provider source logs like `hover ... source=graph|schema result=none|present`.
  - If hover exists but is thin, compare `hover markdown length` and confirm schema metadata exists for that path.

- **IntelliSense (duplicate entries)**
  - Check `completion result count` and `completion duplicate labels`.
  - Use `completion branch=...` to identify generation path (expression, statement, frontmatter graph/schema).
  - Compare `completion top labels` with duplicate groups to confirm whether duplicates are path aliases, enum values, or repeated schema entries.

## Status

🚧 **Under Development** - This extension is part of the initial monorepo setup and full language server integration is being implemented.

## Installation

Install from VS Code marketplace (coming soon) or build from source:

```bash
cd extensions/vscode
pnpm install
pnpm run build
```

## License

Apache-2.0
