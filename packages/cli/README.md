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

## Status

🚧 **Under Development** - This package is part of the initial monorepo setup and CLI functionality is being implemented.

## License

Apache-2.0
