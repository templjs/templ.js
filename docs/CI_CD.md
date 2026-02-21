# CI/CD Infrastructure

Comprehensive documentation for templjs continuous integration and deployment workflows.

## Overview

templjs uses GitHub Actions for automated testing, linting, security scanning, and releases. All workflows are defined in `.github/workflows/` and leverage Nx for efficient caching and affected project detection.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│                  GitHub Actions                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ci.yml                                              │
│  ├─ Install Dependencies (pnpm + cache)             │
│  ├─ Lint (ESLint, Prettier, Nx affected)            │
│  ├─ Type Check (TypeScript tsc)                     │
│  ├─ Test (Vitest, Nx affected)                      │
│  └─ Build (Nx build, Nx affected)                   │
│                                                      │
│  release.yml                                         │
│  ├─ Version Packages (changesets)                   │
│  ├─ Publish to npm                                  │
│  ├─ Create GitHub Release                           │
│  └─ Publish VS Code Extension                       │
│                                                      │
│  codeql.yml                                          │
│  ├─ Initialize CodeQL                               │
│  ├─ Build for Analysis                              │
│  └─ Perform Security Scan                           │
│                                                      │
│  test-secret-scanning.yml                           │
│  └─ TruffleHog Secret Scan (weekly)                 │
│                                                      │
└─────────────────────────────────────────────────────┘
         │              │                │
         ↓              ↓                ↓
    Codecov      GitHub Security   npm Registry
   (coverage)      Advisories       & VS Code
```

## Workflows

### 1. CI Workflow (`ci.yml`)

**Trigger**: Push to main/develop, PRs, nightly scheduled run

**Purpose**: Validate code quality, tests, and builds for every change.

**Jobs**:

#### Install Dependencies

- Sets up Node.js 20, pnpm 8
- Caches pnpm store for faster installs
- Runs `pnpm install --frozen-lockfile`
- Caches Nx computation cache

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

**Trigger**: Manual workflow dispatch or push to `release/**` branches

**Purpose**: Automate versioning and publishing of packages.

**Jobs**:

#### Version and Publish

1. Install dependencies
2. Build all packages
3. Run `changesets/action`:
   - Reads changesets from `.changeset/`
   - Versions packages according to semver
   - Updates CHANGELOG.md files
   - Creates/updates PR with version changes
   - Publishes to npm on merge to main
4. Creates GitHub release with changelog

**Required Secrets**:

- `NPM_TOKEN`: npm authentication token (publish access)
- `GITHUB_TOKEN`: Automatically provided by GitHub

#### Publish VS Code Extension

- Runs after version job completes
- Packages extension with `vsce package`
- Publishes to VS Code Marketplace

**Required Secrets**:

- `VSCODE_PUBLISHER_TOKEN`: Personal Access Token for VS Code Marketplace

**Status**: Manual trigger, not required

### 3. CodeQL Security Analysis (`codeql.yml`)

**Trigger**: Push to main/develop, PRs, weekly scheduled (Monday 3 AM UTC)

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

### 4. Secret Scanning (`test-secret-scanning.yml`)

**Trigger**: Manual workflow dispatch, weekly scheduled (Sunday 12 AM UTC)

**Purpose**: Detect accidentally committed secrets using TruffleHog.

**Configuration**:

- Scans entire repository history
- Detects API keys, tokens, passwords, private keys
- Reports findings in GitHub Security tab

**Status**: Informational, not required

**Local Pre-commit**: Uses `detect-secrets` hook (see `.detect-secrets`)

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

**Example**: Changing only `packages/core/src/lexer.ts`:

- Runs tests for: `@templjs/core`, `@templjs/cli` (depends on core), `@templjs/volar` (depends on core)
- Skips tests for: Unaffected packages
- Uses cached builds if inputs haven't changed

## Required vs Informational Checks

### Required (Block PR Merge)

- ✅ Lint
- ✅ Type Check
- ✅ Test
- ✅ Build

### Informational (Don't Block PRs)

- ℹ️ CodeQL Analysis
- ℹ️ Secret Scanning
- ℹ️ Coverage Report (informational, but tracks trends)

**Branch Protection Rules**:

- Require status checks to pass before merging: Yes
- Required checks: `Lint`, `Type Check`, `Test`, `Build`
- Require branches to be up to date: Yes
- Require linear history: No

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

#### NPM_TOKEN

- **Purpose**: Publish packages to npm registry
- **Type**: npm automation token
- **Scope**: Publish access to `@templjs/*` packages
- **How to Create**:
  1. Log in to npm
  2. Access tokens → Generate new token → Automation
  3. Copy token and add to GitHub secrets

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

1. **Merge PR with changeset** to main
2. **Changesets bot** creates/updates a "Version Packages" PR
3. **Review Version PR**: Check updated versions and CHANGELOGs
4. **Merge Version PR**: Triggers release workflow
5. **Automated publishing**:
   - Publishes packages to npm
   - Creates GitHub release
   - Publishes VS Code extension (if changed)

### Manual Release (Emergency)

```bash
# Version packages locally
pnpm changeset version

# Build and publish
pnpm build
pnpm changeset publish

# Push tags
git push --follow-tags
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
   - Node.js version (CI uses 20, check local with `node --version`)
   - Timezone differences
   - File system case sensitivity (Linux vs macOS/Windows)

2. **Reproduce CI environment locally**:

   ```bash
   # Use same Node.js version
   nvm use 20

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

### Secret Scanning False Positives

**Problem**: Pre-commit hook fails with false positive

**Solution**:

1. Add to `.detect-secrets`:

   ```yaml
   exclude_files: path/to/file\.ts
   ```

2. Mark test data explicitly:

   ```typescript
   // detect-secrets-disable-next-line
   const testApiKey = 'not-a-real-key-12345';
   ```

3. Update baseline:

   ```bash
   detect-secrets scan --baseline .secrets.baseline
   git add .secrets.baseline
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
   - CI uses pnpm 8 (see workflow)
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

### 3. Detect-secrets (Future)

- Scans staged files for secrets
- Detects API keys, tokens, passwords
- Prevents accidental commits

**Configuration**: `.detect-secrets`

### Bypassing Pre-commit Hooks

```bash
# Skip all hooks (use sparingly!)
git commit --no-verify

# Or disable Husky temporarily
HUSKY=0 git commit -m "message"
```

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
- **GitHub Security**: CodeQL and secret scanning results

## Reference

- **Workflows**: `.github/workflows/`
- **Workflow Documentation**: This file
- **Nx Configuration**: `nx.json`
- **Changesets Configuration**: `.changeset/config.json`
- **Codecov Configuration**: `codecov.yml`
- **Secret Scanning**: `.detect-secrets`
