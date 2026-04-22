---
id: cliref-001
type: document
subtype: reference
lifecycle: active
status: ready
title: CLI Reference
---

## Command Overview

`templjs` provides three primary commands:

- `render`
- `validate`
- `init`

Global flags:

- `-h, --help`: show usage/help text
- `--version`: print the CLI version
- `-q, --quiet`: suppress non-error output
- `-v, --verbose`: print diagnostic details
- `--json`: machine-readable output envelopes

## Architecture

- CLI command registration and output-policy wiring: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts)
- ADRs:
  - [ADR 005: Monorepo](./adr/005-monorepo.md)
  - [ADR 006: Testing Strategy](./adr/006-testing.md)

## `render`

Implementation:

- Command registration/action: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts)
- Command implementation: [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts)

```bash
templjs render --template <path> --input <path|-> [options]
```

Options:

- `-t, --template <path>`
- `-i, --input <path>`
- `-o, --output <path>`
- `-w, --watch`
- `--input-format <json|yaml|toml|xml>`
- `--output-format <text|json|html|markdown>`
- `--experimental-stream-json`
- `--no-validate-input`
- `--no-validate-output`

Watch mode behavior:

- `--json --watch` emits JSON envelopes for each render/error event.
- `--quiet --watch` suppresses non-error output.
- `--verbose --watch` keeps diagnostic logging enabled.

## `validate`

Validates template syntax and optionally validates input data against a schema.

Implementation:

- Command registration/action: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts#L322)
- Command implementation: [src/packages/cli/src/commands/validate.ts](../src/packages/cli/src/commands/validate.ts#L15)

```bash
templjs validate --template <path> [--schema <path>] [--input <path>]
```

## `init`

Bootstraps a starter template in your chosen format (Markdown, HTML, JSON, or YAML).

Implementation:

- Command registration/action: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts#L355)
- Command implementation: [src/packages/cli/src/commands/init.ts](../src/packages/cli/src/commands/init.ts#L20)

```bash
templjs init --format <markdown|html|json|yaml> [--output <path>]
```

## Examples

Implementation jump points:

- CLI entrypoint and option handling: [src/packages/cli/src/cli.ts](../src/packages/cli/src/cli.ts)
- Render command behavior (including watch mode): [src/packages/cli/src/commands/render.ts](../src/packages/cli/src/commands/render.ts)

Render to stdout:

```bash
templjs render -t examples/markdown-report/template.md.tmpl -i examples/markdown-report/data.json
```

Render to file:

```bash
templjs render -t template.md.tmpl -i data.json -o out.md
```

Watch mode JSON output:

```bash
templjs --json render -t template.md.tmpl -i data.json --watch
```
