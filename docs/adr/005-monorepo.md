---
id: adr-005
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-005: Monorepo Structure (pnpm + Nx)'
---

## Status

Accepted - February 2026

## Context

The templ.js project consists of multiple interdependent packages:

1. **Core Library** (`@templjs/core`) - Parser, renderer, query engine
2. **CLI Tool** (`@templjs/cli`) - Command-line interface
3. **Volar Plugin** (`@templjs/volar`) - Language server plugin
4. **VS Code Extension** (`vscode-templjs`) - Editor integration

### Requirements

1. **Shared Dependencies**: All packages use TypeScript, Vitest, ESLint
2. **Incremental Builds**: Only rebuild changed packages
3. **Atomic Versioning**: Release all packages with synchronized versions
4. **Local Development**: Test changes across packages without publishing
5. **CI/CD Efficiency**: Parallel builds, smart test execution

### Options Evaluated

| Approach            | Pros                                               | Cons                                                 |
| ------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| **Separate Repos**  | Simple, independent releases                       | Duplicate config, hard to test cross-package changes |
| **npm Workspaces**  | Native npm support                                 | Limited build orchestration                          |
| **pnpm Workspaces** | Efficient disk usage, fast installs                | Requires pnpm CLI                                    |
| **Lerna**           | Battle-tested, versioning tools                    | Heavyweight, maintenance concerns                    |
| **Nx + pnpm**       | ⭐ Caching, task orchestration, workspace analysis | Learning curve                                       |

## Decision

**Use pnpm Workspaces with Nx for build orchestration.**

### Architecture

```bash ascii-tree
templjs/templ.js/
├── pnpm-workspace.yaml        # Workspace definition
├── nx.json                    # Nx configuration
├── package.json               # Root package with shared scripts
├── packages/
│   ├── core/                  # @templjs/core
│   │   ├── package.json       # "name": "@templjs/core"
│   │   ├── src/
│   │   └── tests/
│   ├── cli/                   # @templjs/cli
│   │   ├── package.json       # "name": "@templjs/cli"
│   │   └── "dependencies": {"@templjs/core": "workspace:*"}
│   └── volar/                 # @templjs/volar
│       └── "dependencies": {"@templjs/core": "workspace:*"}
├── extensions/
│   └── vscode/                # vscode-templjs
│       └── "dependencies": {"@templjs/volar": "workspace:*"}
└── tools/
    └── scripts/               # Shared build/release scripts
```

### Key Configuration

**pnpm-workspace.yaml:**

```yaml
packages:
  - 'packages/*'
  - 'extensions/*'
```

**nx.json:**

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint"]
      }
    }
  },
  "targetDefaults": {
    "build": { "dependsOn": ["^build"] }
  }
}
```

### Dependency Management

- **Workspace Protocol**: Use `"workspace:*"` for internal dependencies
- **Shared DevDependencies**: TypeScript, Vitest, ESLint in root `package.json`
- **Package-Specific Dependencies**: Only in individual `package.json` files

## Consequences

### Positive

1. **Efficient Disk Usage**: pnpm's content-addressable storage (saves 50%+ disk space)
2. **Fast Installs**: pnpm is 2x faster than npm, 1.5x faster than yarn
3. **Build Caching**: Nx caches build outputs, skips unchanged packages
4. **Smart Execution**: Nx runs tasks only for affected packages
5. **Dependency Graph**: Nx visualizes package relationships (`nx graph`)
6. **Atomic Changes**: Test all packages together before release
7. **Local Development**: `pnpm link` makes local changes immediately available

### Negative

1. **pnpm Requirement**: Contributors must install pnpm (vs npm is built-in)
2. **Nx Learning Curve**: 1-2 days to understand Nx concepts
3. **Tooling Complexity**: More configuration files than simple npm setup

### Neutral

- **Versioning Strategy**: Will use Changesets for coordinated releases
- **CI/CD**: GitHub Actions has native pnpm support

## Dependency Graph

```bash ascii-flow
vscode-templjs
    ↓
@templjs/volar
    ↓
@templjs/core ← @templjs/cli
```

**Build Order:**

1. `@templjs/core` (no dependencies)
2. `@templjs/cli` + `@templjs/volar` (parallel)
3. `vscode-templjs`

## Performance Targets

| Operation             | Target | Measured With            |
| --------------------- | ------ | ------------------------ |
| **Full Install**      | <30s   | `time pnpm install`      |
| **Incremental Build** | <5s    | `nx build core` (cached) |
| **Affected Tests**    | <20s   | `nx affected:test`       |
| **Full CI Pipeline**  | <3min  | GitHub Actions           |

## Commands

```bash
# Setup
pnpm install              # Install all dependencies

# Development
nx build core             # Build single package
nx build --all            # Build all packages
nx affected:build         # Build only changed packages

# Testing
nx test core              # Test single package
nx affected:test          # Test affected by git changes

# Utilities
nx graph                  # Visualize dependency graph
nx affected:dep-graph     # Show affected by changes
```

## Migration from Python

The Python version used:

- **Single pyproject.toml**: Managed as single package
- **No workspace management**: Separate `temple` and `temple-linter` packages

This monorepo consolidates all TypeScript packages with proper dependency management.

## References

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [Nx Monorepo Guide](https://nx.dev/getting-started/intro)
- [Workspace Protocol Spec](https://pnpm.io/workspaces#workspace-protocol-workspace)
