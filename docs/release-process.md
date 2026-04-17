---
id: releaseprocess-001
type: document
subtype: guide
lifecycle: active
status: ready
title: Release Process
---

## Release Process

This guide is the canonical source of truth for templjs branching, prerelease publishing, promotion, and stable release publication.

## Branch Strategy

templjs uses two long-lived branches:

- `staging`
  - prerelease integration branch
  - default target for normal contributor PRs
- `main`
  - stable promotion branch
  - only branch from which stable releases are cut
  - only branch where the Changesets version PR is consumed

Short-lived branches should branch from `staging`:

- `feature/*`
- `fix/*`
- `chore/*`

Emergency hotfixes may branch from `main`, then back-merge into `staging`.

Merge policy:

- PRs into `staging`: `squash`
- PRs into `main`: `rebase`
- merge commits are disallowed on long-lived branches

## Version Authority

templjs intentionally splits prerelease and stable version authority.

Stable version authority:

- Changesets
- consumed only on `main`

Prerelease version authority:

- CI-generated ephemeral versions
- applied only inside GitHub Actions on `staging`
- never committed back to the repository

## Versioning Model

Changesets configuration lives in [../.changeset/config.json](../.changeset/config.json).

Fixed npm train:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

Independent extension:

- `vscode-templjs`

## Staging Prerelease Lane

Pushes to `staging` can publish prerelease artifacts automatically.

Scope rules:

- npm prereleases publish when the merged diff touches `src/packages/**`
- VS Code prereleases publish when the merged diff touches:
  - `src/extensions/vscode/**`
  - `src/packages/core/**`
  - `src/packages/volar/**`
  - `src/packages/context-graph/**`

Version rules:

- npm packages use:
  - `0.0.0-staging.<run_number>.<run_attempt>`
- VS Code uses a CI-generated next-minor plain semver:
  - stable version `X.Y.Z`
  - staging prerelease version `X.(Y+1).N`
  - `N` derived from workflow run number and attempt

Publishing rules:

- npm publishes to dist-tag `next`
- VS Code publishes with `--pre-release`
- no routine staging tags are created
- no GitHub Release prerelease checkbox is involved

## Main Stable Lane

Stable releases are tag-driven from `main`.

Stable tag lanes:

- npm packages: `vX.Y.Z`
- VS Code extension: `vscode-vX.Y.Z`

Publishing starts only after a GitHub Release is published from one of those tags.

Stable outputs:

- npm publishes to dist-tag `latest`
- VS Code publishes without `--pre-release`

## Contributor Flow

1. Branch from `staging`
2. Implement the change
3. Add a Changeset if the change affects released artifacts
4. Open a PR to `staging`
5. Merge after required CI passes

Changeset rule:

- if a PR changes `src/packages/**` or `src/extensions/vscode/**`, it must include at least one `.changeset/*.md`
- CI enforces this through `Require Changeset`
- the automated version PR on `main` is exempt

## Staging Validation Posture

`staging` is the prerelease soak branch.

Required on `staging`:

- core CI jobs from `ci.yml`

Informational on `staging`:

- `Benchmark Suite`
- `Analyze (javascript-typescript)`

Those checks still run on `staging`, but they do not block prerelease integration there.

## Promotion Flow: `staging` to `main`

Promotion is intentional and maintainer-driven.

Maintainer steps:

1. Open a PR from `staging` to `main`
2. Wait for all required `main` checks to pass
3. Merge using `rebase`

Required on `main` promotion PRs:

- all core CI checks from `ci.yml`
- `Benchmark Suite`
- `Analyze (javascript-typescript)`

This encodes the intended policy:

- benchmark and CodeQL are informational on `staging`
- benchmark and CodeQL become gating only when promoting to `main`

## Stable Release Flow

### 1. Merge the Version PR on `main`

The release workflow maintains an automated Changesets version PR on `main`.

That PR:

- applies pending Changesets
- keeps the four npm packages aligned
- updates the VS Code extension independently when selected
- regenerates `src/extensions/vscode/CHANGELOG.md` when the extension version changes

### 2. Create the Stable Tag

Choose the correct lane:

```bash
# npm packages
git tag v0.2.0
git push origin v0.2.0

# VS Code extension
git tag vscode-v0.3.0
git push origin vscode-v0.3.0
```

### 3. Publish the GitHub Release

In GitHub:

- publish a release from the stable tag
- do not mark it as a prerelease

### 4. Let Automation Publish

The workflow then:

- verifies the tag format and release lane
- verifies the tagged commit is already reachable from `main`
- verifies the tagged version matches the workspace version for that lane
- builds the workspace
- generates release notes
- publishes only the selected lane
- updates the GitHub Release body
- attaches VSIX assets and checksums for extension releases

## Required Configuration

### Branch Protection

Protect both long-lived branches:

- `staging`
- `main`

Shared required checks:

- `Install Dependencies`
- `Lint`
- `Type Check`
- `Lint Work Item Frontmatter`
- `Require Changeset`
- `Require Release Metadata`
- `Docs API Guard`
- all required matrix `Test` jobs
- `Build`

`main`-only additional required checks:

- `Benchmark Suite`
- `Analyze (javascript-typescript)`

### GitHub Environments

Create:

- `prerelease`
- `release`

### npm Trusted Publishing

Configure trusted publishing for:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

Use [../.github/scripts/prepare-npm-trusted-publishing.sh](../.github/scripts/prepare-npm-trusted-publishing.sh) to print the exact package URLs and trusted-publisher values.

Use:

- owner: `templjs`
- repository: `templ.js`
- workflow filename: `release.yml`
- environment name: leave blank

### VS Code Marketplace

Configure:

- `VSCODE_PUBLISHER_TOKEN`
- publisher membership and publish rights for `templjs`

### Tag Protection

Protect:

- `v*`
- `vscode-v*`

Routine staging prereleases do not use tags.

## Related Docs

- [CI/CD Infrastructure](./ci-cd.md)
- [GitHub Actions Workflows](../.github/workflows/README.md)
- [GitHub Organization Setup](../.github/organization-setup.md)
- [Secrets Configuration](../.github/SECRETS.md)
