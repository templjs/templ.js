# templjs: Meta-Templating System

[![codecov](https://codecov.io/github/templjs/templ.js/graph/badge.svg?token=LQF2NinbxD)](https://codecov.io/github/templjs/templ.js)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/templjs/templ.js?utm_source=oss&utm_medium=github&utm_campaign=templjs%2Ftempl.js&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

`templjs` is a declarative, schema-aware meta-templating system for transforming structured data into structured and unstructured text outputs.

Think of it as **XSLT-style transformation power** with **Jinja2/Handlebars authoring ergonomics**, plus **base-language tooling support** and **extensible, validated input/output pipelines**.

## Elevator Pitch

Write one template definition, validate the data contract early, and generate consistent outputs in formats like Markdown, HTML, JSON, YAML, TOML, and XML.

## What templjs Is

- A TypeScript-native successor to the original Temple concept
- A parser/AST-driven template engine for structured-data transformations
- A schema-aware system for validating input data and query paths
- A monorepo with core runtime, CLI, Volar integration, and VS Code extension
- An extensible architecture intended to support multiple syntax themes and adapters

## What templjs Is Not

- Not a finished 1.0 runtime yet
- Not currently a drop-in replacement for full Jinja2/Handlebars/XSLT feature sets
- Not limited to one output format or one editor integration strategy

## Current Status

Early development (active).

Implemented today in `@templjs/core`:

- Tokenizer with configurable delimiters
- Parser that builds a typed AST
- Renderer internals with control-flow and filters
- JSON Schema validation and query-path validation helpers

In progress across the repo:

- Output-format config beyond `.templjs.json` JSON files
- Output validation pipeline end-to-end
- Multi-syntax themes/adapters (v1.1+)

## Feature Matrix

| Area          | Capability                                            | Status      | Notes                                                                |
| ------------- | ----------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| Core          | Configurable delimiter tokenization                   | Implemented | `tokenize()` supports custom statement/expression/comment delimiters |
| Core          | AST parser (text, expressions, if/for/set/block)      | Implemented | Typed AST and parser tests are present                               |
| Core          | Renderer internals (control flow + filters)           | Implemented | `render()` public API available; further stabilization in progress   |
| Core          | JSON Schema input validation                          | Implemented | `SchemaValidator` with Ajv                                           |
| Core          | Query-path validation + fuzzy suggestions             | Implemented | Schema-derived path checks with typo suggestions                     |
| Core          | Output validation pipeline                            | Planned     | In architecture/PRD, not yet end-to-end in runtime                   |
| CLI           | `render` / `validate` / `init` commands               | Implemented | JSON/YAML/TOML/XML input; `.templjs.json`; `--watch` supported       |
| IDE           | Volar language plugin                                 | Implemented | Virtual mapping, diagnostics, completions, hover, definitions        |
| IDE           | VS Code extension + `.tmpl` support                   | Implemented | Preferred `.tmpl`; host-first template suffixes are supported        |
| Extensibility | Multi-syntax themes/adapters (Jinja2/Handlebars/etc.) | Planned     | v1.0 focuses on one syntax style; architecture allows expansion      |
| CI/CD         | Lint/type-check/test/build workflows                  | Implemented | GitHub Actions pipelines configured                                  |

## Monorepo Structure

- [[packages-core]] - parser, lexer, renderer internals, schema/query validation (`@templjs/core`)
- [[packages-cli]] - command-line interface (`@templjs/cli`)
- [[packages-volar]] - Volar language plugin (`@templjs/volar`)
- [[extensions-vscode]] - VS Code extension powered by Volar
- [[docs-adr]] - architecture decisions
- [[docs-prd]] - product requirements

## Quick Start

For full setup, first render, and VS Code authoring guidance, see [Getting Started](docs/getting-started.md).

Monorepo prerequisites:

- Node.js `>=22.12.0 <23 || >=24.0.0 <25`
- pnpm `8.15.0`

Repository setup:

```bash
pnpm install
pnpm test
pnpm build
```

Published packages:

```bash
npm install @templjs/core
npm install -D @templjs/cli
```

VS Code extension:

- <https://marketplace.visualstudio.com/items?itemName=templjs.vscode-templjs>

Useful monorepo commands:

```bash
pnpm lint
pnpm format:check
pnpm type-check
pnpm graph
```

## Documentation

- [Documentation Home](docs/index.md) (recommended entrypoint)
- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli.md)
- [Core and CLI API Reference](docs/api-reference.md)

## Template Syntax (Current)

Current defaults support Jinja2-style block/comment delimiters plus expression tags:

- Statements: `{% ... %}`
- Expressions: `{{ ... }}`
- Comments: `{# ... #}`

Example:

```templ
# Report
{% if user %}
User: {{ user.name | upper }}
{% endif %}

{% for item in items %}
- {{ item.title }}
{% endfor %}
```

Delimiters are configurable to avoid collisions with host/base languages.

## Validation Model

`templjs` treats validation as a first-class concern.

- Input data can be validated with JSON Schema (`Ajv`-based)
- Query paths are checked against schema-derived valid paths
- Fuzzy suggestions are available for typoed paths
- Output validation is part of the intended end-to-end pipeline design

## Base-Language Support

The VS Code/Volar architecture is designed to preserve native tooling for base formats (Markdown, JSON, YAML, HTML) while overlaying template semantics.

Current extension targets commonly use the `.tmpl` suffix:

- `.yaml.tmpl` / `.yml.tmpl`
- `.json.tmpl`
- `.md.tmpl`
- `.html.tmpl`

Compatibility suffixes remain fully supported for host-first naming patterns such as `.md.templ`, `.json.templ`, `.yaml.templ`, and `.html.templ` (alongside `.tmpl`/`.tpl` variants).

For troubleshooting language features, see [VS Code triage logs](src/extensions/vscode/README.md#triage-logs) for quick setup and symptom-specific checks for go-to-definition, hover, and IntelliSense duplicate entries.

## Example: Parse + Validate

```ts
import { tokenize, parse, SchemaValidator } from '@templjs/core';

const template = 'Hello {{ user.name }}';
const tokens = tokenize(template);
const ast = parse(tokens);

const validator = new SchemaValidator({
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  required: ['user'],
});

const dataResult = validator.validate({ user: { name: 'Ada' } });
const pathResult = validator.validateQueryPath('user.name');

console.log(ast.errors, dataResult.valid, pathResult.valid);
```

## Architecture and Roadmap References

- Product requirements: [[v1.0-requirements]]
- ADR-001 (TypeScript migration): [[001-language-migration]]
- ADR-003 (VS Code + Volar architecture): [[003-vscode-architecture]]
- ADR-007 (syntax extensibility): [[007-syntax-extensibility]]
- Development guide: [[DEVELOPMENT]]

## Contributing

- Fork and create a feature branch
- Run `pnpm test`, `pnpm lint`, and `pnpm build` before opening a PR
- Follow Conventional Commits for commit messages
- Document architectural changes in [[docs-adr]]

## License

Apache-2.0

[packages-core]: src/packages/core 'Package: @templjs/core'
[packages-cli]: src/packages/cli 'Package: @templjs/cli'
[packages-volar]: src/packages/volar 'Package: @templjs/volar'
[extensions-vscode]: src/extensions/vscode 'Extension: VS Code integration'
[docs-adr]: docs/adr 'Architecture Decision Records'
[docs-prd]: docs/prd 'Product Requirements Documents'
[v1.0-requirements]: docs/prd/v1.0-requirements.md 'templ.js v1.0 - Product Requirements Document'
[001-language-migration]: docs/adr/001-language-migration.md 'ADR-001: Language Migration from Python to TypeScript'
[003-vscode-architecture]: docs/adr/003-vscode-architecture.md 'ADR-003: VS Code Architecture (Volar)'
[007-syntax-extensibility]: docs/adr/007-syntax-extensibility.md 'ADR-007: Syntax Extensibility and Themes'
[DEVELOPMENT]: DEVELOPMENT.md 'Development Guide'
