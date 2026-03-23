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

- `-q, --quiet`: suppress non-error output
- `-v, --verbose`: print diagnostic details
- `--json`: machine-readable output envelopes

## `render`

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

```bash
templjs validate --template <path> [--schema <path>] [--input <path>]
```

## `init`

```bash
templjs init --format <markdown|html|json|yaml> [--output <path>]
```

## Examples

Render to stdout:

```bash
templjs render -t examples/markdown-report/template.md.templ -i examples/markdown-report/data.json
```

Render to file:

```bash
templjs render -t template.md.templ -i data.json -o out.md
```

Watch mode JSON output:

```bash
templjs --json render -t template.md.templ -i data.json --watch
```
