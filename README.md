# templjs: Meta-Templating System

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

- Public rendering/query APIs stabilization
- Full CLI commands
- Volar-based language server integration
- VS Code extension end-to-end diagnostics/completion mapping

## Feature Matrix

| Area          | Capability                                            | Status      | Notes                                                                  |
| ------------- | ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| Core          | Configurable delimiter tokenization                   | Implemented | `tokenize()` supports custom statement/expression/comment delimiters   |
| Core          | AST parser (text, expressions, if/for/set/block)      | Implemented | Typed AST and parser tests are present                                 |
| Core          | Renderer internals (control flow + filters)           | Partial     | Implemented internally; public API still stabilizing                   |
| Core          | JSON Schema input validation                          | Implemented | `SchemaValidator` with Ajv                                             |
| Core          | Query-path validation + fuzzy suggestions             | Implemented | Schema-derived path checks with typo suggestions                       |
| Core          | Output validation pipeline                            | Planned     | In architecture/PRD, not yet end-to-end in runtime                     |
| CLI           | `process` / `validate` / watch workflows              | Planned     | Current CLI is scaffold-level                                          |
| IDE           | Volar language plugin                                 | Partial     | Plugin scaffold exists; virtual mapping/diagnostics still in progress  |
| IDE           | VS Code extension + `.templ.*` file support           | Partial     | Language IDs/extensions registered; full language features in progress |
| Extensibility | Multi-syntax themes/adapters (Jinja2/Handlebars/etc.) | Planned     | v1.0 focuses on one syntax style; architecture allows expansion        |
| CI/CD         | Lint/type-check/test/build workflows                  | Implemented | GitHub Actions pipelines configured                                    |

## Monorepo Structure

- [[packages-core]] - parser, lexer, renderer internals, schema/query validation (`@templjs/core`)
- [[packages-cli]] - command-line interface (`@templjs/cli`)
- [[packages-volar]] - Volar language plugin (`@templjs/volar`)
- [[extensions-vscode]] - VS Code extension powered by Volar
- [[docs-adr]] - architecture decisions
- [[docs-prd]] - product requirements

## Quick Start

### Prerequisites

- Node.js `>=18`
- pnpm `>=8`

### Setup

```bash
pnpm install
pnpm test
pnpm build
```

### Useful Commands

```bash
pnpm lint
pnpm format:check
pnpm type-check
pnpm graph
```

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

Current extension targets:

- `.templ.yaml` / `.templ.yml`
- `.templ.json`
- `.templ.md`
- `.templ.html`

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

[packages-core]: packages/core 'Package: @templjs/core'
[packages-cli]: packages/cli 'Package: @templjs/cli'
[packages-volar]: packages/volar 'Package: @templjs/volar'
[extensions-vscode]: extensions/vscode 'Extension: VS Code integration'
[docs-adr]: docs/adr 'Architecture Decision Records'
[docs-prd]: docs/prd 'Product Requirements Documents'
[v1.0-requirements]: docs/prd/v1.0-requirements.md 'templ.js v1.0 - Product Requirements Document'
[001-language-migration]: docs/adr/001-language-migration.md 'ADR-001: Language Migration from Python to TypeScript'
[003-vscode-architecture]: docs/adr/003-vscode-architecture.md 'ADR-003: VS Code Architecture (Volar)'
[007-syntax-extensibility]: docs/adr/007-syntax-extensibility.md 'ADR-007: Syntax Extensibility and Themes'
[DEVELOPMENT]: DEVELOPMENT.md 'Development Guide'
