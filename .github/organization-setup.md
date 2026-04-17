# GitHub Organization Setup Guide

This document covers one-time GitHub organization and repository setup for `templjs`.

- use [../docs/release-process.md](../docs/release-process.md) for recurring release operations
- use [SECRETS.md](./SECRETS.md) for secret lookup and rotation guidance

## Prerequisites

- GitHub account with organization/repository admin permissions
- GitHub CLI installed and authenticated: `gh auth login`
- identified organization members and maintainers

## Step 1: Create the Organization

1. Navigate to <https://github.com/organizations/new>
2. Create:
   - organization name: `templjs`
   - account type: Free or higher
3. Configure the organization profile:
   - display name: `TemplJS`
   - description: `Meta-templating system for structured data with TypeScript`
   - website: `https://templjs.org` or GitHub Pages URL

## Step 2: Configure Organization Security

1. Navigate to <https://github.com/organizations/templjs/settings/security>
2. Enable:
   - require two-factor authentication for all members
   - Dependabot alerts
   - Dependabot security updates
   - GitHub Advanced Security, if available
3. Set default repository permissions to `Read`

## Step 3: Create Teams

Recommended teams:

- `maintainers`
  - admin access
- `contributors`
  - write access
- `documentation`
  - write access

Example:

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /orgs/templjs/teams \
  -f name='maintainers' \
  -f description='Core maintainers with full repository access' \
  -f privacy='closed'
```

## Step 4: Create the Repository

```bash
gh repo create templjs/templ.js \
  --public \
  --description "Meta-templating system for structured data with TypeScript" \
  --enable-issues \
  --enable-wiki=false
```

## Step 5: Configure Repository Settings

Navigate to `https://github.com/templjs/templ.js/settings`.

### General

- Issues: enabled
- Wiki: disabled
- Projects: disabled unless intentionally used

### Pull Requests

These repository-level settings must align with branch rulesets:

- allow merge commits: disabled
- allow squash merging: enabled
- allow rebase merging: enabled
- automatically delete head branches: enabled
- allow auto-merge: enabled

This alignment matters because rulesets can restrict allowed merge methods per branch, but GitHub still blocks merges if the repository-level merge settings do not permit those methods globally.

## Step 6: Configure Branch Rulesets

### Automated Setup

Run the setup script from the repo root:

```bash
cd /Users/macos/dev/templjs
./.github/scripts/setup-branch-protection.sh templjs templ.js
```

The script configures:

- repository merge settings:
  - `merge commit`: disabled
  - `squash`: enabled
  - `rebase`: enabled
  - `delete branch on merge`: enabled
- long-lived branch ruleset for:
  - `main`
  - `staging`
- `staging`-specific merge policy:
  - `squash` only
- `main`-specific merge policy:
  - `rebase` only
- required common CI checks on both long-lived branches
- `Benchmark Suite` and `Analyze (javascript-typescript)` as `main`-only promotion gates

### Manual Ruleset Setup

If you configure rulesets by hand, create three branch rulesets.

#### A. Long-Lived Branch Ruleset

Target branches:

- `refs/heads/main`
- `refs/heads/staging`

Rules:

- require pull requests before merging
- require 1 approval
- dismiss stale approvals on push
- require approval of the latest push
- require conversation resolution
- require linear history
- block deletion
- block non-fast-forward updates
- required status checks:
  - `Install Dependencies`
  - `Lint`
  - `Type Check`
  - `Lint Work Item Frontmatter`
  - `Require Changeset`
  - `Docs API Guard`
  - `Test (Node 22, ubuntu-latest)`
  - `Test (Node 22, macos-latest)`
  - `Test (Node 22, windows-latest)`
  - `Test (Node 24, ubuntu-latest)`
  - `Test (Node 24, macos-latest)`
  - `Test (Node 24, windows-latest)`
  - `Build`

Notes:

- `Benchmark Suite` and `Analyze (javascript-typescript)` should not be required on `staging`
- they remain informational there

#### B. `staging` Ruleset

Target branch:

- `refs/heads/staging`

Rules:

- allow merge methods:
  - `squash`

#### C. `main` Ruleset

Target branch:

- `refs/heads/main`

Rules:

- allow merge methods:
  - `rebase`
- additional required status checks:
  - `Benchmark Suite`
  - `Analyze (javascript-typescript)`

This encodes the intended policy:

- `staging`: prerelease integration branch, core CI required, benchmark and CodeQL informational
- `main`: stable promotion branch, core CI plus benchmark and CodeQL required

## Step 7: Configure Release Environments

Navigate to `https://github.com/templjs/templ.js/settings/environments`.

Create:

- `prerelease`
  - optional branch restriction: `staging`
  - no required reviewers by default
- `release`
  - optional required reviewers: maintainers
  - optional tag restrictions:
    - `v*`
    - `vscode-v*`

## Step 8: Configure npm Trusted Publishing

templjs uses npm trusted publishing instead of storing an npm token in GitHub.

Published npm packages:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

Before opening npm settings pages, generate the exact checklist from the repo:

```bash
cd /Users/macos/dev/templjs
./.github/scripts/prepare-npm-trusted-publishing.sh
```

Optional registry preflight:

```bash
./.github/scripts/prepare-npm-trusted-publishing.sh --check-registry
```

For each package:

1. Open the npm package settings URL printed by the helper
2. Under `Publishing`, add GitHub as a trusted publisher
3. Use:
   - owner: `templjs`
   - repository: `templ.js`
   - workflow filename: `release.yml`
   - environment name: leave blank
4. Save

Remaining manual limitation:

- npm trusted publishers are still configured package-by-package in the npm UI

## Step 9: Configure Secrets

Repository Actions secrets:

- `VSCODE_PUBLISHER_TOKEN`
- `CODECOV_TOKEN` if used

See [SECRETS.md](./SECRETS.md) for full details.

## Step 10: Configure Tag Protection

Protect stable release tag lanes:

- `v*`
- `vscode-v*`

Restrict tag creation to maintainers.

Routine `staging` prereleases do not use tags.

## Step 11: Enable GitHub Pages

If GitHub Pages is needed:

1. Create `gh-pages`
2. Configure Pages to publish from `gh-pages`
3. Optionally configure a custom domain

## Step 12: Verification Checklist

- organization exists at <https://github.com/templjs>
- repository exists at <https://github.com/templjs/templ.js>
- repository merge settings allow `squash` and `rebase`, but not merge commits
- `main` and `staging` rulesets are active
- `Benchmark Suite` and `Analyze (javascript-typescript)` are required on `main` only
- `prerelease` and `release` environments exist
- npm trusted publishing is configured for all published packages
- `VSCODE_PUBLISHER_TOKEN` is configured

## Troubleshooting

### Merge method errors during PR merge

- Verify repository settings still allow `squash` and `rebase`
- Verify the branch ruleset has not drifted from repository-level merge settings

### `main` PRs are not gated by benchmark or CodeQL

- Verify the `main`-specific ruleset includes:
  - `Benchmark Suite`
  - `Analyze (javascript-typescript)`

### `staging` PRs are unexpectedly blocked by benchmark or CodeQL

- Verify those checks are not part of the shared long-lived branch ruleset
- Keep them `main`-only
