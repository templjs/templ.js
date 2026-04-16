---
id: cicd-001
type: document
subtype: guide
lifecycle: active
status: ready
title: CI/CD Infrastructure
---

{% raw %}

## CI/CD Infrastructure

Comprehensive documentation for templjs continuous integration and deployment workflows.

This document is the CI/CD reference.

- use [release-process.md](./release-process.md) for the human release runbook
- use [../.github/organization-setup.md](../.github/organization-setup.md) for one-time repository and environment setup
- use [../.github/SECRETS.md](../.github/SECRETS.md) for secret and credential lookup

## Overview

templjs uses GitHub Actions for automated testing, linting, security analysis, benchmarking, and releases. All workflows are defined in `.github/workflows/`, use Nx for affected-project execution, and share a centrally pinned Node.js and pnpm toolchain from the root `package.json`.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│                  GitHub Actions                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ci.yml                                              │
│  ├─ Setup Workspace Toolchain                        │
│  ├─ Lint (ESLint, Prettier, Nx affected)            │
│  ├─ Type Check (TypeScript tsc)                     │
│  ├─ Test (Vitest, Nx affected)                      │
│  └─ Build (Nx build, Nx affected)                   │
│                                                      │
│  release.yml                                         │
│  ├─ Maintain Version PR (changesets)                │
│  ├─ Verify release tag + lane                       │
│  ├─ Generate md.tmpl release notes                  │
│  ├─ Publish npm packages OR VS Code extension       │
│  └─ Finalize GitHub Release                         │
│                                                      │
│  codeql.yml                                          │
│  ├─ Initialize CodeQL                               │
│  ├─ Build for Analysis                              │
│  └─ Perform Security Scan                           │
│                                                      │
│  benchmark.yml                                      │
│  ├─ Run CI Benchmark Harness                        │
│  └─ Publish Artifacts and PR Comparison             │
│                                                      │
│  backlog-automation.yml                             │
│  ├─ Ingest pull request events into backlog         │
│  ├─ Ingest CI workflow_run events into backlog      │
│  └─ Auto-link record:* evidence back to work items  │
│                                                      │
└─────────────────────────────────────────────────────┘
         │              │                │
         ↓              ↓                ↓
    Codecov      GitHub Security   npm Registry
   (coverage)      Advisories       & VS Code
```

## Workflows

### 1. CI Workflow (`ci.yml`)

**Trigger**: Manual dispatch (`workflow_dispatch`), push to `main`/`staging`, pull requests, nightly scheduled run

**Purpose**: Validate code quality, tests, and builds for every change.

**Jobs**:

#### Setup Workspace Toolchain

- Reads Node.js and pnpm pins from the root `package.json`
- Uses the shared `.github/actions/setup-workspace` composite action
- Installs dependencies with `pnpm install --frozen-lockfile`
- Restores pnpm store cache for faster installs

#### Matrix Coverage

- Tests run on Node.js 22 and 24
- Default local development version is Node.js 24
- pnpm is pinned to 8.15.0 everywhere

#### Lint

- Runs ESLint across all packages
- Checks Prettier formatting
- Uses Nx affected to lint only changed packages
- **Status**: Required for PR merge

**Performance Target**: <10 seconds for small PRs

#### Type Check

- Runs TypeScript compiler (`tsc --noEmit`)
- Validates type safety across monorepo
- Uses Nx to check only affected packages
- **Status**: Required for PR merge

**Performance Target**: <15 seconds for small PRs

#### Require Changeset

- Runs on pull requests only
- Fails when a PR changes released artifact paths without adding a `.changeset/*.md` entry
- Applies to:
  - `src/packages/**`
  - `src/extensions/vscode/**`
- Skips the automated Changesets version PR on `main`
- **Status**: Required for PR merge

#### Test

- Runs Vitest tests across all packages
- Generates code coverage reports
- Uploads coverage to Codecov
- Uses Nx affected to test only changed packages
- **Status**: Required for PR merge

**Performance Target**: <30 seconds for full test suite

#### Build

- Builds all packages in dependency order
- Validates build outputs
- Uses Nx build cache for speed
- **Status**: Required for PR merge

**Performance Target**: <2 minutes for full build

**Total PR Time Target**: <5 minutes

### 2. Release Workflow (`release.yml`)

**Trigger**:

- Push to `staging` for automated prerelease publishing
- Push to `main` for version PR maintenance
- GitHub Release `published` events for stable artifact publishing

**Purpose**: Automate branch-based prereleases from `staging` and stable releases from `main`.

**Branch Roles**:

- `staging`: prerelease integration branch
- `main`: stable integration branch

**Release Lanes**:

- prerelease lane on `staging`
  - npm packages publish with CI-generated `0.0.0-staging.*` versions to `next`
  - VS Code publishes with a CI-generated next-minor plain semver version and `--pre-release`
- stable lane on `main`
  - npm packages publish from `vX.Y.Z`
  - VS Code publishes from `vscode-vX.Y.Z`

**Jobs**:

#### Staging Prerelease

- Detects whether the merged push affects npm packages, the VS Code extension, or both
- Applies CI-only prerelease versions in the runner workspace
- Publishes only the affected prerelease lane
- Uses GitHub environment `prerelease`

#### Create Version PR

- Runs on pushes to `main`
- Uses `changesets/action`
- Applies pending Changesets
- Keeps `@templjs/core`, `@templjs/cli`, `@templjs/volar`, and `@templjs/context-graph` on one fixed version train
- Regenerates `src/extensions/vscode/CHANGELOG.md` automatically when `vscode-templjs` version changes
- Opens or updates the "Version Packages" PR

#### Stable Published Release

- Runs only after a GitHub Release is published from a stable tag
- Verifies the tagged commit is already on `main`
- Verifies the tag version matches the selected stable lane in the workspace
- Builds the workspace
- Generates GitHub release notes from commit history using `md.tmpl`
- Publishes only the selected stable lane
- Updates the GitHub Release body and attaches VSIX assets for extension releases

**Required Secrets**:

- `GITHUB_TOKEN`: Automatically provided by GitHub
- `VSCODE_PUBLISHER_TOKEN`: Required for VS Code Marketplace publishing
- No npm publish secret is required once npm trusted publishing is configured for the published packages

**Canonical Runbook**: See [Release Process](./release-process.md) for the branch strategy, manual promotion steps, and configuration details.

### 3. CodeQL Security Analysis (`codeql.yml`)

**Trigger**: Push to main/staging, PRs, weekly scheduled (Monday 3 AM UTC)

**Purpose**: Detect security vulnerabilities using GitHub's semantic code analysis.

**Configuration**:

- **Language**: `javascript-typescript`
- **Queries**: `security-and-quality`
- **Upload**: Results uploaded to GitHub Security tab

**Status**: Informational, not required (won't block PRs)

**Scope**:

- SQL injection
- XSS vulnerabilities
- Path traversal
- Command injection
- Use of insecure dependencies
- Other OWASP top 10 issues

### 4. Benchmark Workflow (`benchmark.yml`)

**Trigger**: Pull requests to `main`/`staging`, pushes to `main`, nightly schedule, manual dispatch

### 5. Backlog Automation (`backlog-automation.yml`)

**Trigger**: Pull request activity on `main`/`staging`, completed `CI` workflow runs, manual dispatch

**Purpose**: Keep canonical backlog work items and evidence records synchronized with GitHub PR and CI events using `doc-vader`.

**Behavior**:

- Checks out the `templjs` repository branch that received the event
- Checks out and builds `doc-vader` from its source repository
- Runs `doc-vader backlog ingest-event --provider github ...`
- Updates work-item PR links, merge commit metadata, and CI-derived `record:*` evidence where applicable
- Commits generated backlog changes back to the source branch when the event came from the same repository

**Status**: Informational automation, not a required merge gate

**Purpose**: Track deterministic benchmark performance and compare PRs against the latest successful `main` baseline when available.

**Configuration**:

- Uses the same centrally pinned Node.js/pnpm toolchain as the rest of CI
- Uploads raw JSON and markdown summaries as workflow artifacts
- Posts comparison output to the PR when a baseline is available

**Status**: Informational, not required

## Nx Affected Strategy

Nx detects which projects are affected by changes and only runs tasks for those projects:

```bash
# Compare against base branch
nx affected -t test --base=origin/main

# Visualize affected projects
nx affected:graph --base=origin/main
```

**Benefits**:

- Faster CI times (only test/build changed packages)
- Efficient resource usage
- Scales with monorepo growth

**Caching**:

- Nx caches task outputs locally and in CI
- Cache key based on inputs (source files, deps, config)
- Restores cache across CI runs

**Example**: Changing only `src/packages/core/src/lexer.ts`:

- Runs tests for: `@templjs/core`, `@templjs/cli` (depends on core), `@templjs/volar` (depends on core)
- Skips tests for: Unaffected packages
- Uses cached builds if inputs haven't changed

## Required vs Informational Checks

### Required (Block PR Merge)

- ✅ Lint
- ✅ Type Check
- ✅ Lint Work Item Frontmatter
- ✅ Require Changeset
- ✅ Docs API Guard
- ✅ Test
- ✅ Build

### Informational (Don't Block PRs)

- ℹ️ CodeQL Analysis
- ℹ️ Coverage Report (informational, but tracks trends)
- ℹ️ Benchmark comparison

**Branch Protection Rules**:

- Protect both `staging` and `main`
- Require status checks to pass before merging: Yes
- Required checks: `Lint`, `Type Check`, `Lint Work Item Frontmatter`, `Require Changeset`, `Docs API Guard`, `Test`, `Build`
- Require branches to be up to date: Yes
- Require linear history: Yes

## Performance Targets

### Per-Workflow Targets

| Workflow   | Target Time | Actual (small PR) | Actual (large PR) |
| ---------- | ----------- | ----------------- | ----------------- |
| Lint       | <10s        | ~8s               | ~15s              |
| Type Check | <15s        | ~12s              | ~25s              |
| Test       | <30s        | ~20s              | ~45s              |
| Build      | <2min       | ~1m 30s           | ~3m 15s           |
| **Total**  | **<5min**   | **~3m 10s**       | **~5m 30s**       |

### Optimization Strategies

1. **Nx Affected Commands**: Only process changed packages
2. **Caching**:
   - pnpm store cache (dependencies)
   - Nx computation cache (task outputs)
3. **Parallelization**: Run independent jobs concurrently
4. **Incremental Builds**: Only rebuild changed packages
5. **Test Sharding**: Split tests across multiple runners (future)

## Secrets Management

### Required Secrets

Configure in GitHub Settings → Secrets and variables → Actions:

#### npm Trusted Publishing

- **Purpose**: Publish `@templjs/*` packages to npm without storing a long-lived token in GitHub
- **Type**: GitHub Actions OIDC trusted publisher configuration on npm
- **How to Create**:
  1. Run `./.github/scripts/prepare-npm-trusted-publishing.sh`
  2. Open the emitted npm settings page for each published package
  3. Add GitHub as a trusted publisher
  4. Use repository `templjs/templ.js`
  5. Use workflow filename `release.yml`
  6. Leave the environment field blank so both prerelease and stable publish jobs can use the same workflow
  7. Save the trusted publisher in npm
- **Automated in-repo already**:
  - GitHub workflow OIDC permissions
  - npm provenance on publish
  - prerelease and stable dist-tag selection

#### VSCODE_PUBLISHER_TOKEN

- **Purpose**: Publish VS Code extension to marketplace
- **Type**: Azure DevOps Personal Access Token
- **Scope**: Marketplace → Publish permission
- **How to Create**:
  1. Go to [Azure DevOps](https://dev.azure.com/)
  2. User settings → Personal access tokens
  3. New token → Marketplace → Publish
  4. Copy token and add to GitHub secrets

#### CODECOV_TOKEN

- **Purpose**: Upload coverage reports to Codecov
- **Type**: Codecov project token
- **Scope**: Read/write coverage data
- **How to Create**:
  1. Log in to [Codecov](https://about.codecov.io/)
  2. Add repository
  3. Copy token and add to GitHub secrets

### Automatic Secrets

#### GITHUB_TOKEN

- **Purpose**: Authenticate GitHub Actions, create releases, comment on PRs
- **Automatically provided**: Yes, no configuration needed
- **Permissions**: Defined in workflow file (`permissions:` section)

## Changesets Workflow

We use [Changesets](https://github.com/changesets/changesets) for version management:

### Creating a Changeset

```bash
# After making changes, run
pnpm changeset

# Select changed packages
# Select version bump type (major, minor, patch)
# Write changelog entry

# Commit the changeset
git add .changeset/
git commit -m "chore: add changeset for vX.Y.Z"
```

### Release Process

1. **Merge feature PR with changeset** to `staging`
2. **Validate prerelease artifacts** from `staging`
3. **Promote `staging` to `main`**
4. **Changesets bot** creates/updates a "Version Packages" PR on `main`
5. **Review Version PR**: Check updated versions and generated changelog content
6. **Merge Version PR**
7. **Create stable release tag**:
   - `vX.Y.Z` for npm packages
   - `vscode-vX.Y.Z` for the VS Code extension
8. **Publish GitHub Release**
9. **Automated stable publishing**:
   - Publishes only the selected stable lane
   - Updates GitHub release notes from generated markdown
   - Attaches VSIX artifacts for extension releases

See [Release Process](./release-process.md) for the detailed flowchart and maintainer checklist.

### Manual Release (Emergency)

```bash
# Apply version changes locally
pnpm exec tsx scripts/release/prepare-version-pr.ts

# Commit and push the generated version updates before tagging
git add .changeset src/packages src/extensions/vscode CHANGELOG.md
git commit -m "chore(release): prepare emergency release"
git push origin main

# Build artifacts
pnpm build

# Package lane
git tag vX.Y.Z
git push origin vX.Y.Z

# Extension lane
git tag vscode-vX.Y.Z
git push origin vscode-vX.Y.Z

# Publish the corresponding GitHub Release manually
```

## Codecov Integration

Coverage reports are uploaded to [Codecov](https://codecov.io/) for tracking trends.

**Configuration**: `codecov.yml` in repository root

```yaml
coverage:
  status:
    project:
      default:
        target: 80% # Overall project coverage target
        threshold: 5% # Allow 5% decrease
    patch:
      default:
        target: 80% # New code coverage target
        threshold: 5%
```

**Viewing Reports**:

- Comment on PRs with coverage diff
- Dashboard: <https://codecov.io/gh/yourusername/templjs>
- Coverage badge in README.md

## Debugging CI Failures

### Tests Fail in CI but Pass Locally

1. **Check environment differences**:
   - Node.js version (CI tests Node.js 22 and 24, check local with `node --version`)
   - Timezone differences
   - File system case sensitivity (Linux vs macOS/Windows)

2. **Reproduce CI environment locally**:

   ```bash
   # Use a supported Node.js version
   nvm use 24

   # Ensure the pinned pnpm version
   corepack enable
   corepack prepare pnpm@8.15.0 --activate

   # Clear caches
   pnpm nx reset
   rm -rf node_modules
   pnpm install --frozen-lockfile

   # Run tests
   pnpm test
   ```

3. **Check workflow logs**:
   - GitHub Actions → Failed workflow → Job → Step logs

### Cache Issues

**Problem**: Nx cache provides stale results

**Solution**:

```bash
# Clear Nx cache in CI
# Add step to workflow:
- name: Reset Nx cache
  run: pnpm nx reset
```

**Problem**: pnpm cache corruption

**Solution**:

```bash
# Delete and recreate cache
# In workflow, change cache key version in:
key: ${{ runner.os }}-pnpm-store-v2-${{ hashFiles('**/pnpm-lock.yaml') }}
```

### Dependency Installation Failures

**Problem**: pnpm install fails in CI

**Solution**:

1. **Check lockfile is committed**:

   ```bash
   git status pnpm-lock.yaml
   ```

2. **Update lockfile locally**:

   ```bash
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "chore: update lockfile"
   ```

3. **Check pnpm version matches**:
   - CI uses pnpm 8.15.0 (from root `package.json`)
   - Local: `pnpm --version`

## Local Pre-commit Hooks

Husky runs these checks before each commit:

### 1. Lint-staged

- Formats changed files with Prettier
- Lints changed files with ESLint
- Auto-fixes issues when possible

**Configuration**: `package.json` → `lint-staged`

### 2. Commitlint

- Validates commit message format
- Enforces conventional commits
- Checks type, scope, subject

**Configuration**: `.commitlintrc.json`

### 3. Repo Hook Runner

- Executes the current repo-defined pre-commit flow from `scripts/ci/hook-runner.ts`
- Keeps pre-commit and pre-push checks aligned with root scripts
- Secret scanning is not currently enforced by a dedicated hook or standalone workflow

Fix failing hooks instead of bypassing them so local validation stays aligned with CI.

## Future Enhancements

### Planned Improvements

1. **E2E Testing**:
   - Add Playwright tests for VS Code extension
   - Run in CI with headless VS Code

2. **Visual Regression Testing**:
   - Snapshot testing for syntax highlighting
   - Compare rendered templates

3. **Performance Benchmarks**:
   - Track lexer/parser/renderer performance
   - Alert on regressions

4. **Automatic Dependency Updates**:
   - Renovate bot for weekly updates
   - Auto-merge minor/patch updates if tests pass

5. **Test Sharding**:
   - Split tests across multiple CI runners
   - Reduce total test time

6. **Remote Nx Cache**:
   - Cache Nx outputs on S3 or Nx Cloud
   - Share cache across team members and CI

## Monitoring & Observability

### Metrics to Track

- **CI Duration**: Total time for PR workflows
- **Test Duration**: Time to run full test suite
- **Cache Hit Rate**: Percentage of Nx cache hits
- **Flaky Tests**: Tests that fail intermittently
- **Coverage Trends**: Code coverage over time

### Dashboards

- **GitHub Actions**: Workflow run history
- **Codecov**: Coverage trends and reports
- **GitHub Security**: CodeQL results and repository security alerts

## Reference

- **Workflows**: `.github/workflows/`
- **Workflow Documentation**: This file
- **Nx Configuration**: `nx.json`
- **Changesets Configuration**: `.changeset/config.json`
- **Codecov Configuration**: `codecov.yml`

{% endraw %}
