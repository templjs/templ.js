# @templjs/cli

![TemplJS logo](https://raw.githubusercontent.com/templjs/templ.js/refs/heads/main/assets/templjs.png)

Command-line interface for templjs rendering, validation, and starter generation.

## Overview

The templjs CLI provides tools for:

- Rendering template files with data inputs
- Validating template syntax
- Bootstrapping starter templates
- Watch mode for continuous re-rendering

## Installation

```bash
pnpm add -g @templjs/cli
```

## Usage

```bash
# Render a template
templjs render --template template.md.tmpl --input data.json

# Validate template syntax
templjs validate --template template.md.tmpl

# Render in watch mode
templjs render --template template.md.tmpl --input data.json --watch

# Generate a starter template
templjs init --format markdown --output starter.md.tmpl
```

## Commands

- `render` - Render a template with data
- `validate` - Check template syntax
- `init` - Generate starter templates

Use `templjs render --watch` to watch template and input files and re-render on changes.

## Experimental

The `render` command supports an opt-in streaming JSON parser for large inputs:

```bash
templjs render --template template.tmpl --input data.json --experimental-stream-json
```

You can also enable it via environment variable:

```bash
TEMPLJS_EXPERIMENTAL_STREAM_JSON=1 templjs render --template template.tmpl --input data.json
```

## Status

Implemented in the current monorepo release baseline. See [docs/cli.md](https://github.com/templjs/templ.js/blob/main/docs/cli.md) for the canonical command reference.

For full project documentation, start at [docs/index.md](https://github.com/templjs/templ.js/blob/main/docs/index.md).

## License

Apache-2.0
