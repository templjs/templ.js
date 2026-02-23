# Repository Structure

Comprehensive guide to the templjs monorepo organization, naming conventions, and file locations.

## Overview

templjs is organized as a pnpm workspace monorepo using Nx for build orchestration and caching. The repository contains multiple packages, extensions, documentation, and development infrastructure.

## Directory Tree

```bash
templjs/
├── .agents/                    # AI agent skills and configurations
│   ├── skills/                 # Agent skill definitions
│   └── skills-manifest.md      # Catalog of all skills
├── .changeset/                 # Changesets for versioning
│   ├── config.json             # Changeset configuration
│   └── *.md                    # Individual changesets
├── .github/                    # GitHub configuration
│   ├── workflows/              # GitHub Actions workflows
│   │   ├── ci.yml              # CI workflow (tests, lint, build)
│   │   ├── release.yml         # Release workflow (publish)
│   │   ├── codeql.yml          # Security scanning
│   │   └── test-secret-scanning.yml  # Secret detection
│   ├── ISSUE_TEMPLATE/         # Issue templates
│   ├── PULL_REQUEST_TEMPLATE.md  # PR template
│   └── copilot-instructions.md  # Copilot agent instructions
├── .husky/                     # Git hooks (pre-commit, commit-msg)
├── .nx/                        # Nx cache (ignored by Git)
├── backlog/                    # Work items and planning
│   ├── NNN_work_item.md        # Active work items
│   └── archive/                # Completed work items
│       └── NNN_work_item.md
├── docs/                       # Documentation
│   ├── adr/                    # Architecture Decision Records
│   │   └── NNN-title.md        # Individual ADRs
│   ├── prd/                    # Product Requirements Documents
│   ├── CI_CD.md                # CI/CD infrastructure guide
│   ├── REPOSITORY_STRUCTURE.md # This file
│   └── RUNBOOK.md              # Operations runbook
├── examples/                   # Example templates and usage
│   ├── README.md               # Examples overview
│   └── *.templ                 # Example template files
├── extensions/                 # IDE extensions
│   └── vscode/                 # VS Code extension
│       ├── src/
│       ├── syntaxes/           # TextMate grammars
│       ├── package.json        # Extension manifest
│       └── tsconfig.json
├── packages/                   # Published packages
│   ├── core/                   # @templjs/core
│   │   ├── src/
│   │   │   ├── lexer/          # Tokenization
│   │   │   ├── parser/         # AST generation
│   │   │   ├── renderer/       # Template rendering
│   │   │   ├── query/          # Query engine
│   │   │   └── __tests__/      # Tests (co-located)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── README.md
│   ├── cli/                    # @templjs/cli
│   │   ├── src/
│   │   │   ├── commands/       # CLI commands
│   │   │   ├── utils/          # Utilities
│   │   │   └── __tests__/
│   │   ├── bin/                # CLI entry point
│   │   ├── package.json
│   │   └── README.md
│   └── volar/                  # @templjs/volar
│       ├── src/
│       │   ├── language-service/  # Language features
│       │   ├── utils/
│       │   └── __tests__/
│       ├── package.json
│       └── README.md
├── schemas/                    # JSON schemas
│   └── frontmatter/            # Document frontmatter schemas
│       ├── by-type/            # Schemas selected by frontmatter `type`
│       │   ├── document/
│       │   │   ├── current.json
│       │   │   ├── v1.0.0.json
│       │   │   └── latest.json
│       │   └── work-item/
│       │       ├── current.json
│       │       ├── v1.0.0.json
│       │       └── latest.json
│       ├── support/            # Shared schema building blocks
│       │   ├── base/
│       │   ├── contracts/
│       │   ├── overlays/
│       │   └── payloads/
│       └── schema-map.json     # Type -> schema routing map
├── .detect-secrets             # Secret scanning configuration
├── .editorconfig               # Editor configuration
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore rules
├── .markdownlint.yaml          # Markdown linting rules
├── .npmrc                      # npm configuration
├── .prettierrc.json            # Prettier configuration
├── codecov.yml                 # Codecov configuration
├── DEVELOPMENT.md              # Development guide
├── MIGRATION_PLAN.md           # Migration from Python version
├── nx.json                     # Nx configuration
├── package.json                # Root package configuration
├── pnpm-lock.yaml              # Dependency lockfile
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── README.md                   # Project overview
├── templjs.code-workspace      # VS Code workspace file
└── tsconfig.base.json          # Base TypeScript configuration
```

## Package Organization

### Core Package (`@templjs/core`)

**Purpose**: Core template engine (lexer, parser, renderer, query engine)

**Key Directories**:

- `src/lexer/`: Tokenization (Chevrotain lexer)
- `src/parser/`: Parsing (Chevrotain parser)
- `src/renderer/`: Template rendering engine
- `src/query/`: Query language (dot notation, JMESPath)
- `src/types/`: TypeScript type definitions
- `src/__tests__/`: Co-located tests

**Entry Point**: `src/index.ts`

**Exports**:

- `createLexer()`: Lexer factory
- `createParser()`: Parser factory
- `render()`: Template rendering
- `query()`: Query data
- Types: `Token`, `AST`, `RenderOptions`

### CLI Package (`@templjs/cli`)

**Purpose**: Command-line interface for template processing

**Key Directories**:

- `src/commands/`: CLI commands (render, watch, validate)
- `src/utils/`: CLI utilities (file I/O, formatting)
- `src/__tests__/`: CLI tests
- `bin/`: CLI entry point script

**Entry Point**: `bin/templjs`

**Commands**:

- `templjs render <template> <data>`: Render template
- `templjs watch <dir>`: Watch mode
- `templjs validate <template>`: Validate syntax

### Volar Plugin (`@templjs/volar`)

**Purpose**: Volar language service plugin for IDE integration

**Key Directories**:

- `src/language-service/`: Language features (hover, completion, diagnostics)
- `src/utils/`: Plugin utilities
- `src/__tests__/`: Plugin tests

**Entry Point**: `src/index.ts`

**Exports**:

- `createVolarPlugin()`: Plugin factory
- Language service providers

### VS Code Extension (`vscode-templjs`)

**Purpose**: VS Code integration via Volar

**Key Directories**:

- `src/`: Extension source code
- `syntaxes/`: TextMate grammar for syntax highlighting
- `client/`: Language client
- `server/`: Language server (uses Volar)

**Entry Point**: `src/extension.ts`

**Features**:

- Syntax highlighting
- Diagnostics
- Hover information
- Auto-completion
- Go to definition

## Documentation Organization

### Architecture Decision Records (`docs/adr/`)

**Purpose**: Document significant architectural decisions

**Naming Convention**: `NNN-title.md` (e.g., `001-language-migration.md`)

**Format**: MADR (Markdown Any Decision Records)

Sections:

- Status: accepted, proposed, deprecated, superseded
- Context: Problem statement
- Decision: What was decided
- Consequences: Implications of the decision

**Index**: Maintained in `docs/adr/README.md`

### Product Requirements (`docs/prd/`)

**Purpose**: Product specifications and feature requirements

**Naming Convention**: `feature-name.md`

**Format**: Custom PRD template

Sections:

- Overview
- Goals
- User stories
- Technical specification
- Success metrics

### Guides (`docs/`)

**Purpose**: User and developer documentation

**Key Files**:

- `CI_CD.md`: CI/CD infrastructure
- `REPOSITORY_STRUCTURE.md`: This file
- `RUNBOOK.md`: Operations guide
- `DEVELOPMENT.md`: Development guide (root)

## Work Item Organization

### Active Work Items (`backlog/`)

**Purpose**: Track in-progress and planned work

**Naming Convention**: `NNN_description.md` (e.g., `005_chevrotain_lexer.md`)

**Numbering**:

- Sequential numbering starting from 001
- Zero-padded to 3 digits (001, 002, ..., 099, 100)
- Gaps are acceptable (deleted/rejected items)

**Frontmatter** (see `schemas/frontmatter/by-type/work-item/latest.json`):

```yaml
---
id: '005'
title: 'Implement Chevrotain Lexer'
status: in_progress # not_started, in_progress, testing, completed
priority: high # low, medium, high, critical
estimated_hours: 8
actual_hours: 6
started_date: 2026-02-18
completed_date: null
tags: [core, lexer, v1.0]
dependencies: ['002']
branch: feature/005-chevrotain-lexer
related_commits: [abc123, def456]
related_prs: [42]
---
```

**Sections**:

- Goal
- Background
- Tasks
- Deliverables
- Acceptance Criteria
- Notes

### Archived Work Items (`backlog/archive/`)

**Purpose**: Historical record of completed work

**When to Archive**:

- Status: completed
- PR merged to main
- All acceptance criteria met

**Process**:

```bash
# Update final status
# Edit backlog/NNN_item.md frontmatter:
# status: completed
# completed_date: 2026-02-18
# actual_hours: X

# Move to archive
mv backlog/NNN_item.md backlog/archive/

# Commit
git add backlog/archive/NNN_item.md
git commit -m "chore: archive work item NNN"
```

## Naming Conventions

### Files

| Type          | Convention           | Example                     |
| ------------- | -------------------- | --------------------------- |
| Source files  | `kebab-case.ts`      | `template-tokenizer.ts`     |
| Test files    | `*.test.ts`          | `lexer.test.ts`             |
| Config files  | `lowercase.json`     | `tsconfig.json`             |
| Documentation | `SCREAMING_KEBAB.md` | `README.md`, `CI_CD.md`     |
| Work items    | `NNN_description.md` | `005_chevrotain_lexer.md`   |
| ADRs          | `NNN-title.md`       | `001-language-migration.md` |
| Examples      | `descriptive.templ`  | `user-profile.templ`        |

### Branches

| Type    | Convention                | Example                        |
| ------- | ------------------------- | ------------------------------ |
| Feature | `feature/NNN-description` | `feature/005-chevrotain-lexer` |
| Bugfix  | `fix/NNN-description`     | `fix/042-parser-edge-case`     |
| Release | `release/vX.Y.Z`          | `release/v1.0.0`               |
| Hotfix  | `hotfix/vX.Y.Z`           | `hotfix/v1.0.1`                |
| Chore   | `chore/description`       | `chore/update-deps`            |

### Commits

**Format**: [Conventional Commits](https://www.conventionalcommits.org/)

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `test`: Test changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `ci`: CI/CD changes

**Scopes**:

- `core`: @templjs/core changes
- `cli`: @templjs/cli changes
- `volar`: @templjs/volar changes
- `vscode`: VS Code extension changes
- `deps`: Dependency updates
- `docs`: Documentation updates
- `ci`: CI/CD updates

**Examples**:

```text
feat(core): implement Chevrotain lexer
fix(parser): handle nested expressions correctly
docs: update README with installation steps
chore(deps): upgrade chevrotain to v11
test(lexer): add edge case for empty templates
ci: add secret scanning workflow
```

### Pull Requests

**Title Format**: Same as commit message (conventional commits)

**Label Conventions**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `chore`: Maintenance
- `breaking`: Breaking change
- `needs-review`: Awaiting review
- `work-in-progress`: Not ready for review
- `blocked`: Dependent on other work

**PR Number**: Auto-assigned by GitHub

### Packages & Scopes

All published packages use `@templjs/` scope:

- `@templjs/core`: Core engine
- `@templjs/cli`: CLI tool
- `@templjs/volar`: Volar plugin

Non-scoped:

- `vscode-templjs`: VS Code extension (marketplace requirement)

## Configuration Files

### Root Level

- **`package.json`**: Root package, scripts, dev dependencies
- **`pnpm-workspace.yaml`**: Workspace configuration
- **`nx.json`**: Nx configuration (caching, affected commands)
- **`tsconfig.base.json`**: Base TypeScript configuration (extended by packages)
- **`.eslintrc.json`**: Root ESLint configuration
- **`.prettierrc.json`**: Prettier configuration
- **`.editorconfig`**: Editor settings (indentation, line endings)
- **`.markdownlint.yaml`**: Markdown linting rules
- **`.gitignore`**: Git ignore patterns
- **`.npmrc`**: npm configuration (registry, scope)
- **`codecov.yml`**: Codecov coverage thresholds
- **`.detect-secrets`**: Secret scanning configuration

### Package Level

Each package has:

- **`package.json`**: Package metadata, scripts, dependencies
- **`tsconfig.json`**: TypeScript configuration (extends root)
- **`vitest.config.ts`**: Vitest test configuration
- **`README.md`**: Package documentation

### Extension Level

VS Code extension has:

- **`package.json`**: Extension manifest (contributes, activationEvents)
- **`tsconfig.json`**: TypeScript configuration
- **`.vscodeignore`**: Files to exclude from extension package

## Special Directories

### `.nx/` (Git Ignored)

Nx computation cache. Contains cached task outputs for faster rebuilds.

**Do not commit**: Automatically regenerated

### `node_modules/` (Git Ignored)

Package dependencies installed by pnpm.

**Do not commit**: Installed via `pnpm install`

### `.husky/` (Committed)

Git hooks for pre-commit checks.

**Commit**: Ensures all contributors use same hooks

### `.changeset/` (Committed)

Changesets for version management. Individual changesets are committed, cache is ignored.

**Commit**: `*.md` files (changesets)  
**Ignore**: `.changeset/.cache/`

## Dependency Management

### Dependency Types

```json
{
  "dependencies": {}, // Runtime dependencies
  "devDependencies": {}, // Development-only dependencies
  "peerDependencies": {}, // Required by consumers
  "optionalDependencies": {} // Optional enhancements
}
```

### Workspace Dependencies

Internal packages reference each other via workspace protocol:

```json
{
  "dependencies": {
    "@templjs/core": "workspace:*"
  }
}
```

This is resolved to the actual version on publish.

### Dependency Versions

- **~**: Patch updates only (`~1.2.3` → `1.2.x`)
- **^**: Minor updates (`^1.2.3` → `1.x.x`)
- **exact**: No updates (`1.2.3` → `1.2.3`)

**Policy**: Use `^` for most dependencies, exact for critical dependencies

## Build Outputs

### `.gitignore` Patterns

```gitignore
# Build outputs
dist/
*.tsbuildinfo
.nx/cache

# Dependencies
node_modules/

# Test coverage
coverage/

# Environment
.env
.env.local

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db
```

### Build Artifacts

- **`dist/`**: Compiled JavaScript (ESM + CJS)
- **`*.tsbuildinfo`**: TypeScript incremental build info
- **`coverage/`**: Test coverage reports

## Migration Context

### From Python to TypeScript

This repository is the TypeScript rewrite of the original Python temple project.

**Legacy Repository**: `/Users/macos/dev/temple/` (Python)  
**New Repository**: `/Users/macos/dev/templjs/` (TypeScript)

**Migration Plan**: See `MIGRATION_PLAN.md` for detailed roadmap

**Coexistence**: Both versions exist during migration period

### Architectural Differences

| Aspect    | Python (Legacy)          | TypeScript (New)               |
| --------- | ------------------------ | ------------------------------ |
| Parser    | Custom recursive descent | Chevrotain (parser combinator) |
| LSP       | Custom Python LSP        | Volar plugin (TypeScript)      |
| Testing   | pytest                   | Vitest                         |
| Build     | setup.py                 | pnpm + Nx                      |
| Packaging | PyPI                     | npm + VS Code marketplace      |

## Reference

- **Monorepo Structure**: Defined by this file
- **Naming Conventions**: This file
- **Build System**: Nx (`nx.json`)
- **Package Manager**: pnpm (`pnpm-workspace.yaml`)
- **Work Item Schema**: `schemas/frontmatter/by-type/work-item/latest.json`
- **Document Schema**: `schemas/frontmatter/by-type/document/latest.json`
- **Migration Plan**: `MIGRATION_PLAN.md`
