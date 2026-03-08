# @templjs/cli

Command-line interface for templjs template processing.

## Overview

The templjs CLI provides tools for:

- Processing template files with data inputs
- Validating template syntax
- Generating output files
- Watch mode for continuous processing

## Installation

```bash
pnpm add -g @templjs/cli
```

## Usage

```bash
# Process a template
templjs process template.yaml data.json

# Validate template syntax
templjs validate template.yaml

# Watch mode
templjs watch template.yaml data.json --output output.yaml
```

## Commands

- `process` - Process a template with data
- `validate` - Check template syntax
- `watch` - Watch files and regenerate on changes

## Experimental

The `render` command supports an opt-in streaming JSON parser for large inputs:

```bash
templjs render --template template.templ --input data.json --experimental-stream-json
```

You can also enable it via environment variable:

```bash
TEMPLJS_EXPERIMENTAL_STREAM_JSON=1 templjs render --template template.templ --input data.json
```

## Status

🚧 **Under Development** - This package is part of the initial monorepo setup and CLI functionality is being implemented.

## License

Apache-2.0
