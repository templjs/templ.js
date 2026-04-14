# GitHub Actions Workflows

This directory contains CI/CD workflows for the templjs monorepo.

## Workflows Overview

### 1. CI Pipeline (`ci.yml`)

**Triggers:**

- Push to `main` or `staging` branches
- Pull requests to `main` or `staging`
- Scheduled runs (nightly at 2 AM UTC)

**Jobs:**

- **Install**: Sets up pnpm with caching
- **Lint**: Runs ESLint and Prettier checks on affected packages
- **Type Check**: Validates TypeScript compilation
- **Require Changeset**: Ensures contributor PRs touching released artifacts include a `.changeset/*.md` entry
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

- Push to `staging` for automated prerelease publishing
- Push to `main` for Changesets version PR maintenance
- GitHub Releases published from stable tags created on `main`
  - `vX.Y.Z` tags publish npm package stable releases
  - `vscode-vX.Y.Z` tags publish VS Code extension stable releases

**Jobs:**

- **Create Version PR**:
  - Runs on `main`
  - Uses Changesets to open or update the versioning pull request
  - Keeps the four npm packages on one fixed version train
  - Regenerates `src/extensions/vscode/CHANGELOG.md` automatically when the extension version changes
- **Prepare Staging Prerelease**:
  - Runs on `staging`
  - Detects whether the merged push affects npm packages, the VS Code extension, or both
  - Computes CI-only prerelease versions without committing them back to the repo
- **Publish Staging npm Prerelease**:
  - Publishes the fixed npm package train to dist-tag `next`
  - Uses synchronized `0.0.0-staging.*` versions
- **Publish Staging VS Code Prerelease**:
  - Publishes a VSIX built with a CI-generated next-minor plain semver version
  - Uses `--pre-release`
- **Prepare Published Release**:
  - Runs only after a GitHub Release is published
  - Requires a `vX.Y.Z` or `vscode-vX.Y.Z` tag that points to a commit already reachable from `main`
  - Verifies the selected release lane matches the version in the workspace
- **Build Release Assets**:
  - Builds the workspace for the release commit
  - Generates GitHub release notes from commit and PR-style messaging via `md.tmpl`
  - Packages the VS Code extension into a VSIX and generates a checksum for extension releases
- **Publish npm Packages**:
  - Runs only for `vX.Y.Z` tags
  - Publishes npm packages to the correct dist-tag (`next` for prereleases, `latest` for stable releases)
  - Prefers npm trusted publishing via GitHub OIDC and falls back to `NPM_TOKEN` when configured
- **Publish VS Code Extension**:
  - Runs only for `vscode-vX.Y.Z` tags
  - Uses `vsce package --no-dependencies` to avoid monorepo dependency scan failures
  - Uses `--pre-release` when the GitHub Release is marked prerelease
  - Publishes from `--packagePath`, not from the raw workspace tree
  - Uploads the packaged VSIX back onto the GitHub Release

**Features:**

- ✅ Automated version bumping via Changesets
- ✅ Automated branch-based prereleases from `staging`
- ✅ Separate release lanes for npm packages and the VS Code extension
- ✅ GitHub Release-driven stable publishing with immutable release metadata
- ✅ npm publishing with `next` and `latest` channel targets
- ✅ VS Code Marketplace publishing with explicit prerelease/stable behavior
- ✅ VSIX and checksum assets attached to the GitHub Release
- ✅ Templated release notes and automated VS Code changelog refresh

### 3. Security Scanning (`codeql.yml`)

**Triggers:**

- Push to `main` or `staging` branches
- Pull requests to `main` or `staging`
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

- Pull requests to `main` and `staging`
- Pushes to `main`
- Scheduled nightly runs
- Manual workflow dispatch

**Jobs:**

- **Benchmark Suite**:
  - Runs the deterministic CI benchmark harness on a fixed Ubuntu/Node/pnpm stack
  - Uploads machine-readable result JSON and markdown summaries as artifacts
  - Compares PR runs against the latest successful `main` benchmark artifact when available
  - Updates the job summary and a sticky PR comment with the comparison markdown

**Features:**

- ✅ Stable benchmark artifacts for `main` and nightly runs
- ✅ Informational PR comparisons against the latest successful `main` baseline
- ✅ Repository-owned threshold policy via `benchmarks/policy.json`
- ✅ Non-gating workflow ready for future regression enforcement

### 5. Backlog Automation (`backlog-automation.yml`)

**Triggers:**

- Pull request open/edit/reopen/synchronize/close on `main` and `staging`
- Completed `CI` workflow runs
- Manual workflow dispatch

**Jobs:**

- **Ingest Pull Request Event**:
  - Runs for same-repository PR branches
  - Builds `doc-vader` and ingests the GitHub event payload
  - Updates canonical work-item PR links and merge metadata
- **Ingest Workflow Run Event**:
  - Runs for same-repository `CI` workflow completions
  - Builds `doc-vader` and ingests the workflow payload
  - Generates and links `record:*` evidence for CI outcomes when enough structured data is available

**Features:**

- ✅ Canonical backlog mutations routed through `doc-vader`
- ✅ Automatic PR link updates on work items
- ✅ Automatic CI evidence record generation and linking
- ✅ Auto-commit of backlog changes back to the relevant branch for same-repo events

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
- Fixed-version releases across the four npm packages only
- Independent versioning for `vscode-templjs`

## Required Secrets

See [SECRETS.md](../SECRETS.md) for detailed setup instructions.

| Secret                   | Required    | Purpose                                                        |
| ------------------------ | ----------- | -------------------------------------------------------------- |
| `NPM_TOKEN`              | Fallback    | Publish npm packages when trusted publishing is not configured |
| `VSCODE_PUBLISHER_TOKEN` | Yes         | Publish VS Code extension                                      |
| `CODECOV_TOKEN`          | Recommended | Upload coverage reports                                        |

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

Use [release-process.md](../../docs/release-process.md) as the canonical release runbook.

Short version:

1. Merge contributor PRs with Changesets into `staging`
2. Let `staging` publish prerelease artifacts automatically
3. Promote `staging` to `main`
4. Merge the automated Changesets version PR on `main`
5. Create `vX.Y.Z` or `vscode-vX.Y.Z`
6. Publish the stable GitHub Release

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

- Ensure secrets are configured (see `../SECRETS.md`)
- Check Codecov token is set (can work without, but recommended)

### Release Workflow Fails

- Verify `NPM_TOKEN` has publish permissions if you are not using trusted publishing
- If using trusted publishing, verify npm trusted publisher configuration matches this repository/workflow
- Check package names aren't already taken on npm
- Ensure the `@templjs` npm scope is registered
- Confirm the tagged commit is already reachable from `main`
- Confirm package release tags match the npm package version exactly (`vX.Y.Z`)
- Confirm extension release tags match the extension version exactly (`vscode-vX.Y.Z`)
- Remember that `vscode-templjs` is versioned independently and published via `vsce`, not npm

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
