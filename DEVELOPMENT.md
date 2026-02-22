# Development Guide

Complete guide for setting up and contributing to templjs.

## Quick Start

Get from clone to first commit in under 15 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/templjs.git
cd templjs

# 2. Install dependencies (2-3 minutes)
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

- **Node.js**: 18.0.0 or later
- **pnpm**: 8.0.0 or later
- **Git**: 2.x or later
- **VS Code** (recommended): Latest stable version

### Installing Prerequisites

#### Node.js

```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from https://nodejs.org/
```

#### pnpm

```bash
npm install -g pnpm@8

# Or using corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@8.15.0 --activate
```

## Installation

### First-Time Setup

```bash
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

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode (in a package directory)
cd packages/core
pnpm test --watch

# Run tests for affected packages only
pnpm nx affected -t test
```

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
3. **Secret scanning**: Detects accidentally committed secrets

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
   # Use frontmatter schema from schemas/frontmatter/work-item.json
   ```

2. **Create a feature branch**:

   ```bash
   git checkout -b feature/005-new-feature
   ```

3. **Implement with tests**:

   ```bash
   # Write tests first (TDD)
   cd packages/core
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

1. **Update lexer** (packages/core/src/lexer/):

   ```typescript
   // Add CAPITALIZE token if needed
   ```

2. **Update parser** (packages/core/src/parser/):

   ```typescript
   // Add capitalize production rule
   ```

3. **Update renderer** (packages/core/src/renderer/):

   ```typescript
   // Implement capitalize function
   export function capitalize(str: string): string {
     return str.charAt(0).toUpperCase() + str.slice(1);
   }
   ```

4. **Add tests** (`packages/core/src/__tests__/`):

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

**Solutions**:

```bash
# Bypass hooks (use sparingly!)
git commit --no-verify

# Or disable Husky temporarily
HUSKY=0 git commit -m "message"

# Fix the actual issue (recommended)
pnpm lint:fix
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
cd packages/core
pnpm test:coverage
```

### Secret Scanning False Positives

**Problem**: Pre-commit hook fails with false positive secrets.

**Solutions**:

1. **If it's a false positive**, add to `.detect-secrets`:

   ```yaml
   exclude_files: path/to/file\.ts
   ```

2. **If it's test data**, mark explicitly:

   ```typescript
   // detect-secrets-disable-next-line
   const testSecret = 'not-a-real-secret-12345';
   ```

3. **Update baseline**:

   ```bash
   detect-secrets scan --baseline .secrets.baseline
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
pnpm test:coverage                 # Run with coverage
cd packages/core && pnpm test     # Test specific package

# Linting & Formatting
pnpm lint                          # Lint all packages
pnpm lint:fix                      # Lint and auto-fix
pnpm format                        # Format all files
pnpm format:check                  # Check formatting

# Building
pnpm build                         # Build all packages
pnpm clean                         # Clean all build outputs

# Changesets
pnpm changeset                     # Create a changeset
pnpm changeset version             # Version packages
pnpm changeset publish             # Publish packages
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
