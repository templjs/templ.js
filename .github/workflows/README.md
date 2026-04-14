# GitHub Actions Workflows

This directory contains CI/CD workflows for the templjs monorepo.

## Workflows Overview

### 1. CI Pipeline (`ci.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Scheduled runs (nightly at 2 AM UTC)

**Jobs:**

- **Install**: Sets up pnpm with caching
- **Lint**: Runs ESLint and Prettier checks on affected packages
- **Type Check**: Validates TypeScript compilation
- **Test**: Runs tests with coverage on Node 22 and 24
- **Build**: Builds all affected packages

**Features:**

- ✅ Nx affected commands for efficient execution
- ✅ pnpm store caching for faster installs
- ✅ Nx cache restoration between runs
- ✅ Codecov integration for coverage reports
- ✅ Parallel job execution
- ✅ Build artifact upload

### 2. Release Workflow (`release.yml`)

**Triggers:**

- Push to `main` for Changesets version PR maintenance
- Pushes of release tags created from `main`
  - `pre-vX.Y.Z` for pre-release channel publishing
  - `vX.Y.Z` for stable channel publishing

**Jobs:**

- **Create Version PR**:
  - Runs on `main`
  - Uses Changesets to open or update the versioning pull request
  - Keeps the fixed-version release train synchronized across the npm packages and VS Code extension
- **Tagged Publish**:
  - Runs only for tags created from `main`
  - Verifies the tagged commit is reachable from `main`
  - Verifies all fixed-release package versions match the tag version
  - Publishes npm packages to the correct dist-tag (`next` for `pre-v*`, `latest` for `v*`)
  - Publishes the VS Code extension using the packaged VSIX flow
  - Creates a GitHub Release matching the tag channel
- **Publish VS Code Extension**:
  - Uses `vsce package --no-dependencies` to avoid monorepo dependency scan failures
  - Uses `--pre-release` for `pre-v*` tags and stable publish for `v*` tags
  - Publishes from `--packagePath`, not from the raw workspace tree

**Features:**

- ✅ Automated version bumping via Changesets
- ✅ Tag-driven npm publishing with `next` and `latest` channel targets
- ✅ VS Code Marketplace publishing with explicit pre-release/stable behavior
- ✅ GitHub release creation
- ✅ Changelog generation

### 3. Security Scanning (`codeql.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Scheduled runs (weekly on Monday at 3 AM UTC)

**Jobs:**

- **Analyze**: Runs CodeQL analysis for JavaScript/TypeScript

**Features:**

- ✅ Security and quality queries
- ✅ Automatic vulnerability detection
- ✅ Results uploaded to GitHub Security tab
- ✅ Weekly scheduled scans

### 4. Benchmark Publishing (`benchmark.yml`)

**Triggers:**

- Pull requests to `main` and `develop`
- Pushes to `main`
- Pushes to `release/**`
- Scheduled nightly runs
- Manual workflow dispatch

**Jobs:**

- **Benchmark Suite**:
  - Runs the deterministic CI benchmark harness on a fixed Ubuntu/Node/pnpm stack
  - Uploads machine-readable result JSON and markdown summaries as artifacts
  - Compares PR runs against the latest successful `main` benchmark artifact when available
  - Updates the job summary and a sticky PR comment with the comparison markdown

**Features:**

- ✅ Stable benchmark artifacts for `main`, nightly, and release branches
- ✅ Informational PR comparisons against the latest successful `main` baseline
- ✅ Repository-owned threshold policy via `benchmarks/policy.json`
- ✅ Non-gating workflow ready for future regression enforcement

## Configuration Files

### `codecov.yml`

Codecov configuration with:

- Project coverage target: 90%
- Patch coverage target: 85%
- PR comments with coverage diffs
- Ignore patterns for test/build files

### `.changeset/config.json`

Changesets configuration for release automation:

- Public access for all packages
- Main branch as base
- Automatic peer dependency updates
- Fixed-version monorepo releases across the npm packages and VS Code extension

## Required Secrets

See [SECRETS.md](./SECRETS.md) for detailed setup instructions.

| Secret                   | Required    | Purpose                   |
| ------------------------ | ----------- | ------------------------- |
| `NPM_TOKEN`              | Yes         | Publish npm packages      |
| `VSCODE_PUBLISHER_TOKEN` | Yes         | Publish VS Code extension |
| `CODECOV_TOKEN`          | Recommended | Upload coverage reports   |

## Usage

### Running CI Locally

> **Node.js versions**: CI runs against **Node 22** and **Node 24** (see `engines` and `toolchain` in `package.json`).
> To match CI locally, pin your version with [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm):
>
> ```bash
> # nvm
> nvm install 24 && nvm use 24
> # fnm
> fnm use 24
> ```
>
> A `.nvmrc` file with `24` at the repo root is also recognised automatically by both tools.

```bash
# Install dependencies
corepack enable
corepack prepare pnpm@8.15.0 --activate
pnpm install

# Run linting (affected)
pnpm nx affected -t lint

# Run type checking
pnpm type-check

# Run tests with coverage
pnpm nx affected -t test --coverage

# Build packages
pnpm nx affected -t build
```

### Creating a Release

1. Create changeset files for changes:

   ```bash
   pnpm changeset
   ```

2. Commit the changeset files

3. Merge the generated versioning PR back to `main`

4. Create a release tag from the release commit on `main`

`pre-vX.Y.Z` publishes npm packages to `next`, the VS Code extension as pre-release, and a pre-release GitHub Release.

`vX.Y.Z` publishes npm packages to `latest`, the VS Code extension as stable, and a stable GitHub Release.

Workflow behavior:

Maintains a Changesets version PR on `main`, publishes the fixed version set after a tag is pushed from `main`, creates GitHub release notes for the matching tag, and publishes the VS Code extension via the packaged VSIX flow.

### Viewing Coverage

Coverage reports are uploaded to [Codecov](https://codecov.io) after test runs.
View detailed coverage at: `https://codecov.io/gh/yourusername/templjs`

### Security Scanning

CodeQL results appear in the Security tab after each scan.
View results at: `https://github.com/yourusername/templjs/security/code-scanning`

### Benchmark Artifacts

Benchmark workflow artifacts are published from the `Benchmark` workflow:

- `benchmark-results`: raw benchmark JSON, markdown summary, and current policy file
- `benchmark-comparison`: PR comparison JSON and markdown when a `main` baseline is available

To make benchmark regressions blocking later, keep the workflow as-is and flip `"enforce": true` in `benchmarks/policy.json` once the team is ready.

## Nx Affected Commands

The CI workflow uses Nx affected commands to only process changed packages:

```bash
# Compare against origin/main
nx affected:test --base=origin/main
nx affected:lint --base=origin/main
nx affected:build --base=origin/main

# With parallel execution
nx affected -t test --parallel=3
```

## Caching Strategy

1. **pnpm Store**: Cached using pnpm-lock.yaml hash
2. **Nx Cache**: Cached using lockfile + SHA for precise cache hits
3. **Build Artifacts**: Uploaded for 7 days

## Troubleshooting

### CI Fails on First Run

- Ensure secrets are configured (see SECRETS.md)
- Check Codecov token is set (can work without, but recommended)

### Release Workflow Fails

- Verify NPM_TOKEN has publish permissions
- Check package names aren't already taken on npm
- Ensure the `@templjs` npm scope is registered
- Confirm the tagged commit is already reachable from `main`
- Confirm the tag matches package versions exactly (`pre-vX.Y.Z` or `vX.Y.Z`)
- Remember that `vscode-templjs` is versioned with Changesets but published via `vsce`, not npm

### Security Scan Fails

- CodeQL requires successful build
- Check TypeScript compilation errors first

## Badge Examples

Add these to your README.md:

```markdown
[![CI](https://github.com/yourusername/templjs/workflows/CI/badge.svg)](https://github.com/yourusername/templjs/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yourusername/templjs/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/templjs)
[![CodeQL](https://github.com/yourusername/templjs/workflows/CodeQL/badge.svg)](https://github.com/yourusername/templjs/actions/workflows/codeql.yml)
```
