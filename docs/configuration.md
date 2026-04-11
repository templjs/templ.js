---
id: configuration-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Configuration Guide
---

{% raw %}

## Overview

templjs CLI configuration is loaded from a `.templjs.json` file discovered by walking upward from the current working directory.

Source implementation:
Source implementation: [src/packages/cli/src/config/loader.ts](../src/packages/cli/src/config/loader.ts), [src/packages/cli/src/config/schema.ts](../src/packages/cli/src/config/schema.ts), [src/packages/cli/src/config/types.ts](../src/packages/cli/src/config/types.ts)

## Discovery Rules

`loadConfig()` searches from the current working directory upward to the filesystem root for `.templjs.json`.

Behavior summary:

- nearest readable `.templjs.json` wins
- if no config is found, CLI flags are still accepted and validated
- invalid JSON or schema failures raise a descriptive error

## Supported Fields

```json
{
  "inputFormat": "json",
  "outputFormat": "markdown",
  "defaultTemplate": "templates/report.md.templ",
  "defaultOutput": "dist/report.md",
  "templateDelimiters": {
    "statement_start": "{%",
    "statement_end": "%}",
    "expression_start": "{{",
    "expression_end": "}}"
  },
  "validation": {
    "validateInput": true,
    "validateOutput": false,
    "schemaPath": "schemas/report.json"
  }
}
```

## Field Reference

| Field                       | Type                               | Description                                             |
| --------------------------- | ---------------------------------- | ------------------------------------------------------- |
| `inputFormat`               | `json \| yaml \| toml \| xml`      | Default input parser format.                            |
| `outputFormat`              | `text \| json \| html \| markdown` | Default output target format.                           |
| `defaultTemplate`           | `string`                           | Default template path when a command option is omitted. |
| `defaultOutput`             | `string`                           | Default output file path.                               |
| `templateDelimiters`        | `object`                           | Override template delimiter pairs.                      |
| `validation.validateInput`  | `boolean`                          | Enable/disable input validation by default.             |
| `validation.validateOutput` | `boolean`                          | Enable/disable output validation by default.            |
| `validation.schemaPath`     | `string`                           | Default schema path applied when `--schema` is omitted. |

## CLI Precedence

CLI flags override config file values.

Examples:

- `templjs render --input-format yaml` overrides `inputFormat` from `.templjs.json`
- `templjs validate --schema my-schema.json` overrides `validation.schemaPath`
- if a CLI option is omitted, the config value fills the gap

Implementation reference:
Implementation reference: [applyConfig()](../src/packages/cli/src/config/loader.ts)

## Environment Variable Expansion

String values support `${NAME}` and `${NAME:-fallback}` syntax.

Example:

```json
{
  "defaultOutput": "${REPORT_OUTPUT:-dist/report.md}",
  "validation": {
    "schemaPath": "${REPORT_SCHEMA}"
  }
}
```

Behavior:

- `${NAME}` requires the environment variable to exist
- `${NAME:-fallback}` uses `fallback` when the variable is missing
- unresolved required variables throw a config load error

Current limitation:

- nested fallback expressions are not supported

## Delimiter Configuration

Use `templateDelimiters` when host-language syntax collides with the default delimiters.

```json
{
  "templateDelimiters": {
    "statement_start": "[%",
    "statement_end": "%]",
    "expression_start": "[[",
    "expression_end": "]]"
  }
}
```

## Validation Configuration

`validation` controls default validation behavior for CLI workflows.

Example:

```json
{
  "validation": {
    "validateInput": true,
    "validateOutput": true,
    "schemaPath": "schemas/input.json"
  }
}
```

## Common Workflows

### Default Markdown Report Render

```json
{
  "inputFormat": "json",
  "outputFormat": "markdown",
  "defaultTemplate": "examples/markdown-report/template.md.templ"
}
```

### Schema-Validated Validation Command

```json
{
  "validation": {
    "validateInput": true,
    "schemaPath": "examples/markdown-report/data.schema.json"
  }
}
```

## Troubleshooting

- `Invalid JSON in <path>`: the config file does not parse as JSON
- `Invalid .templjs.json (...)`: the config shape failed schema validation
- `Missing environment variable "NAME"`: an unresolved `${NAME}` placeholder was encountered

## Related Guides

- [CLI Reference](./cli.md)
- [Query Language Guide](./query-language.md)
- [Getting Started with templjs](./getting-started.md)

{% endraw %}
