---
id: development-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Development Guide
---

## Development Guide

Complete guide for setting up and contributing to templjs.

## Quick Start

Get from clone to first commit in under 15 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/templjs.git
cd templjs

# 2. Activate the pinned package manager and install dependencies
corepack enable
corepack prepare pnpm@8.15.0 --activate
pnpm install

# 3. Run tests to verify setup
pnpm test

# 4. Build all packages
pnpm build

# 5. Make a change and commit
git checkout -b feature/my-feature
# ... make changes ...
pnpm test && pnpm lint
git add .
git commit -m "feat: my awesome feature"
```

## Prerequisites

- **Node.js**: 22.12+ or 24.x
- **pnpm**: 8.15.0
- **Git**: 2.x or later
- **VS Code** (recommended): Latest stable version

### Installing Prerequisites

#### Node.js

```bash
# Using nvm (recommended)
nvm install 24
nvm use 24

# Or download from https://nodejs.org/
```

#### pnpm

```bash
corepack enable
corepack prepare pnpm@8.15.0 --activate
```

## Installation

### First-Time Setup

```bash
# Activate the pinned package manager
corepack enable
corepack prepare pnpm@8.15.0 --activate

# Install all dependencies
pnpm install

# Set up Git hooks
pnpm prepare

# Verify installation
pnpm test
pnpm lint
pnpm build
```

This installs:

- Package dependencies across the monorepo
- Husky pre-commit hooks
- Nx build system
- Development tools (ESLint, Prettier, TypeScript)

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run coverage for affected projects (CI equivalent)
pnpm run test:affected:ci

# Run package-level coverage
pnpm --filter @templjs/core test:coverage
pnpm --filter @templjs/cli test:coverage
pnpm --filter @templjs/volar test:coverage

# Run tests in watch mode (in a package directory)
cd src/packages/core
pnpm test --watch

# Run tests for affected packages only
pnpm nx affected -t test --base=main
```

### Coverage Requirements

- Coverage thresholds are enforced per package via each `vitest.config.ts`.
- The CI path uses `pnpm run test:affected:ci`, which runs affected tests with `--coverage` enabled.
- To inspect local reports, run a package `test:coverage` script and open the generated `coverage/` output for that package.
- If a legitimate threshold adjustment is required, propose it in a work item and include justification + impacted package scope.

### Running Linters

```bash
# Lint all packages
pnpm lint

# Lint with auto-fix
pnpm lint:fix

# Lint root configuration only
pnpm lint:root

# Format all files
pnpm format

# Check formatting without changes
pnpm format:check
```

### Building Packages

```bash
# Build all packages
pnpm build

# Build affected packages only
pnpm nx affected -t build

# Build specific package
pnpm nx build @templjs/core

# Build with dependencies
pnpm nx build @templjs/cli --with-deps
```

### Visualizing Dependencies

```bash
# Open interactive dependency graph
pnpm graph

# Show affected projects
pnpm nx affected:graph
```

## Pre-Commit Hooks

Husky runs these checks automatically before each commit:

1. **Lint-staged**: Formats and lints changed files
2. **Commitlint**: Validates commit message format (conventional commits)
3. **Repo hook runner**: Executes the current repo-defined pre-commit flow from `scripts/ci/hook-runner.ts`

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `test`: Test changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `ci`: CI/CD changes

**Examples:**

```bash
feat(core): add support for custom delimiters
fix(parser): handle nested expressions correctly
docs: update README with installation steps
chore(cli): upgrade chevrotain to v11
test(lexer): add edge case for empty templates
```

## Common Tasks

### Adding a New Feature

1. **Create a work item** (if not exists):

   ```bash
   # Work items live in backlog/
   # Follow naming: NNN_description.md
   # Use frontmatter schema from schemas/frontmatter/by-type/work-item/latest.json
   ```

2. **Create a feature branch**:

   ```bash
   git checkout -b feature/005-new-feature
   ```

3. **Implement with tests**:

   ```bash
   # Write tests first (TDD)
   cd src/packages/core
   # Edit src/__tests__/feature.test.ts

   # Implement feature
   # Edit src/feature.ts

   # Run tests
   pnpm test
   ```

4. **Commit changes**:

   ```bash
   git add .
   git commit -m "feat(core): implement new feature

   - Add Feature class with X functionality
   - Add comprehensive tests (95% coverage)
   - Update documentation

   Work Item: [[005_new_feature.md]]
   Status: testing"
   ```

5. **Push and create PR**:

   ```bash
   git push origin feature/005-new-feature
   gh pr create --fill
   ```

### Adding a Built-In Function

Example: Adding a `capitalize` filter function

1. **Update lexer** (`src/packages/core/src/lexer/`):

   ```typescript
   // Add CAPITALIZE token if needed
   ```

2. **Update parser** (`src/packages/core/src/parser/`):

   ```typescript
   // Add capitalize production rule
   ```

3. **Update renderer** (`src/packages/core/src/renderer/`):

   ```typescript
   // Implement capitalize function
   export function capitalize(str: string): string {
     return str.charAt(0).toUpperCase() + str.slice(1);
   }
   ```

4. **Add tests** (`src/packages/core/src/` or `src/packages/core/test/`):

   ```typescript
   describe('capitalize filter', () => {
     it('capitalizes first letter', () => {
       expect(capitalize('hello')).toBe('Hello');
     });
   });
   ```

5. **Update documentation** (docs/):

   ````markdown
   ## capitalize

   Capitalizes the first letter of a string.

   ```templ
   {{ name | capitalize }}
   ```
   ````

### Updating Documentation

1. **Format**: All docs use Markdown with frontmatter
2. **Location**:
   - Architecture decisions: `docs/adr/`
   - Guides: `docs/`
   - Work items: `backlog/`
3. **Schema**: Validate frontmatter against schemas in `schemas/frontmatter/`
4. **Linting**: Run `pnpm lint` to check markdown formatting

### Creating a Pull Request

1. **Ensure tests pass**:

   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

2. **Update work item**:

   ```markdown
   ---
   status: testing
   ---
   ```

3. **Create PR**:

   ```bash
   gh pr create --title "feat(core): implement feature X" \
                --body "$(cat backlog/005_feature_x.md)"
   ```

4. **Link work item**: Add `Work Item: [[005_feature_x.md]]` to PR description

### Releasing a New Version

See [RUNBOOK.md](docs/RUNBOOK.md#releasing-a-new-version) for complete release process.

Quick version:

```bash
# 1. Create changeset
pnpm changeset

# 2. Commit changeset
git add .changeset/
git commit -m "chore: add changeset for vX.Y.Z"

# 3. Merge to main triggers release workflow
```

## Troubleshooting

### Husky Blocks Commits

**Problem**: Pre-commit hook fails and prevents commit.

**Recommended workflow**:

```bash
# Fix the actual issue
pnpm lint:fix
pnpm test
```

### Test Timeouts

**Problem**: Tests hang or timeout in CI.

**Solutions**:

```bash
# Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
  },
});

# Run specific test file
pnpm test src/__tests__/specific.test.ts

# Check for infinite loops or unresolved promises
```

### Coverage Drops

**Problem**: Codecov reports coverage decrease.

**Solutions**:

```bash
# Generate coverage report locally
pnpm test:coverage

# View HTML report
open coverage/index.html

# Add tests for uncovered lines
# Run specific package coverage
cd src/packages/core
pnpm test:coverage
```

### Nx Cache Issues

**Problem**: Nx reports stale build outputs.

**Solutions**:

```bash
# Clear Nx cache
pnpm nx reset

# Clear all caches
rm -rf .nx/cache

# Clear node_modules and reinstall
pnpm clean
pnpm install
```

### Dependency Conflicts

**Problem**: pnpm install fails with peer dependency errors.

**Solutions**:

```bash
# Update lockfile
pnpm install --no-frozen-lockfile

# Force resolution (edit package.json)
{
  "pnpm": {
    "overrides": {
      "problematic-dep": "^1.0.0"
    }
  }
}

# Remove lockfile and reinstall
rm pnpm-lock.yaml
pnpm install
```

### TypeScript Errors in VS Code

**Problem**: VS Code shows TypeScript errors that don't exist in CLI.

**Solutions**:

```bash
# Restart TypeScript server
# CMD+Shift+P -> "TypeScript: Restart TS Server"

# Rebuild packages
pnpm build

# Check from CLI
pnpm type-check
```

## IDE Setup

### VS Code (Recommended)

#### Required Extensions

Install from VS Code marketplace:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - Linting
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - Formatting
- [Vitest](https://marketplace.visualstudio.com/items?itemName=ZixuanChen.vitest-explorer) - Test runner

#### Recommended Extensions

- [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) - Nx integration
- [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) - Git integration
- [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) - Inline diagnostics
- [Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree) - TODO tracking

#### Workspace Settings

Already configured in `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": [{ "mode": "auto" }]
}
```

### Other IDEs

#### WebStorm

1. Enable ESLint: Preferences → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. Enable Prettier: Preferences → Languages & Frameworks → JavaScript → Prettier
3. Set up Node interpreter: Preferences → Languages & Frameworks → Node.js

## Development Tools

### CLI Commands Reference

```bash
# Nx commands
pnpm nx <target> <project>        # Run target for project
pnpm nx run-many -t <target>      # Run target for all projects
pnpm nx affected -t <target>      # Run target for affected projects
pnpm nx graph                      # Visualize dependency graph
pnpm nx reset                      # Clear Nx cache

# Testing
pnpm test                          # Run all tests
pnpm test:coverage                 # Run with coverage when available in package scope
pnpm --filter @templjs/core test   # Test specific package

# Linting & Formatting
pnpm lint                          # Lint all packages
pnpm lint:fix                      # Lint and auto-fix
pnpm format                        # Format all files
pnpm format:check                  # Check formatting

# Building
pnpm build                         # Build all packages
pnpm clean                         # Clean all build outputs

```

## Changesets & Version Management

## Overview

This monorepo uses **[Changesets](https://github.com/changesets/changesets)** for automated version management. The four npm packages (`@templjs/core`, `@templjs/cli`, `@templjs/volar`, `@templjs/context-graph`) are configured with **fixed versioning**—they must always release with the same version number. The VS Code extension (`vscode-templjs`) is versioned independently.

### Why Fixed Versioning?

- Coordinated releases: all packages ship v1.0.0, not v1.0.0, v0.9.5, v1.1.0
- Simplified user experience: one version to track
- Clearer dependency management across the monorepo

### Configuration

See [`.changeset/config.json`](.changeset/config.json):

```json
{
  "fixed": [["@templjs/core", "@templjs/cli", "@templjs/volar", "@templjs/context-graph"]],
  "updateInternalDependencies": "patch"
}
```

## Proper Workflow

### For Contributors (All Changes)

```bash
# 1. Make your code changes
git checkout -b feature/my-feature
# ... edit files ...

# 2. When ready for PR, create a changeset
pnpm changeset

# You'll be prompted to:
# - Select changed packages (Ctrl+Space to toggle, Enter to submit)
# - Choose bump type: patch | minor | major
# - Write a brief changelog entry
```

**Example:**

```text
$ pnpm changeset
? Which packages would like to bump?
  ◉ @templjs/core
  ◉ @templjs/cli
  ◉ @templjs/volar
  ◉ @templjs/context-graph
  ◉ vscode-templjs

? What kind of change is this for @templjs/core (Currently at 1.0.0)?
  ◯ patch (bugfix)
  ◯ minor (feature)
  ◉ major

? Write a summary for this change...
  Update parser to support whitespace controls
```

This creates `.changeset/<id>-<desc>.md` with your change details.

### 3. Commit the changeset

```bash
git add .changeset/
git commit -m "chore: add changeset for feature description"
git push
```

### 4. Create PR normally

The changeset goes in the PR; CI validates it.

### For Release (Maintainers Only)

When merging a feature branch with a changeset:

1. **Changesets bot** detects the changeset and creates an automated "Version Packages" PR
2. **Review the Version PR**: Check proposed versions align with semver intent
3. **Merge Version PR**: Triggers automated release workflow:
   - Updates all root + workspace `package.json` versions (synchronized)
   - Updates `CHANGELOG.md` entries
   - Creates GitHub release
   - Publishes to npm + VS Code Marketplace

## Common Pitfalls

### ❌ DON'T: Manually Edit `package.json` Versions

**Problem**: Breaks the automation; versions desynchronize

```bash
# WRONG - skips Changesets entirely
sed -i 's/"version": "1.0.0"/"version": "1.1.0"/g' package.json
git add package.json && git commit -m "bump version"
```

**Result**:

- ❌ No `CHANGELOG.md` entry
- ❌ Release workflow fails
- ❌ Packages become misaligned
- ❌ No post-release Git tag

### ✅ DO: Use Changesets

```bash
# CORRECT
pnpm changeset
# ... follow prompts ...
git add .changeset/ && git commit
```

**Result**:

- ✅ Changelog auto-generated
- ✅ All versions sync perfectly
- ✅ Release workflow triggers correctly
- ✅ GitHub release created automatically

### ❌ DON'T: Skip Changesets for Bug Fixes

Even tiny changes need a changeset entry so users see them in release notes:

```bash
# WRONG
git commit -m "fix: resolve edge case in parser"
git push
```

**Result**:

- ❌ Change doesn't appear in release notes
- ❌ Users don't know about the fix

### ✅ DO: Include Changesets for All Changes

```bash
# CORRECT - even for patch fixes
pnpm changeset
# Select packages, choose "patch", describe the fix
git add .changeset/ && git commit
```

## Emergency Manual Release

**Only if automated release workflow fails:**

```bash
# 1. Verify changes are committed and pushed
git status  # should be clean

# 2. Version packages locally
pnpm changeset version

# 3. Review changes
git diff HEAD package.json

# 4. Commit and tag
git commit -am "chore(release): v1.1.0"
git tag v1.1.0
git push && git push --tags

# 5. Publish manually (credentials required)
pnpm publish -r --access public
```

## Verification Checklist

Before merging a PR with changesets:

- [ ] `.changeset/*.md` file exists and is committed
- [ ] Changeset file lists all affected packages
- [ ] Semver bump type matches the change scope
- [ ] Changelog entry is clear and user-facing
- [ ] No manual `package.json` version edits in the PR
- [ ] CI lint:frontmatter passes (validates changeset format)

## Testing Locally

To test the full release flow without publishing:

```bash
# Simulate what the Version PR would do
pnpm changeset version

# Preview what would be committed
git diff

# Undo without committing
git reset --hard
```

## Useful Commands

```bash
pnpm changeset                     # Create a changeset
pnpm changeset version             # Version packages (for testing)
pnpm changeset publish             # Publish packages (typically handled by CI)
pnpm changeset status              # Show current changeset status
cat .changeset/config.json         # Review version config
```

### Environment Variables

Create `.env.local` for local overrides (ignored by Git):

```bash
# Debug mode
DEBUG=templjs:*

# Skip certain checks
SKIP_PREFLIGHT_CHECK=true
```

## Getting Help

- **Documentation**: [docs/](docs/)
- **Architecture Decisions**: [docs/adr/](docs/adr/)
- **Work Items**: [backlog/](backlog/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/templjs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/templjs/discussions)

## Contributing Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) (when created) for:

- Code of Conduct
- PR submission guidelines
- Code review process
- Release process
- Governance model
