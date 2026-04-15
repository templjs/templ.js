# GitHub Organization Setup Guide

This document outlines the manual steps required to set up the `templjs` GitHub organization. While some tasks can be automated (see [setup-branch-protection.sh](scripts/setup-branch-protection.sh)), others require manual configuration through the GitHub web interface.

This document is the one-time setup guide for repository administration.

- use [../docs/release-process.md](../docs/release-process.md) for recurring release operations
- use [SECRETS.md](./SECRETS.md) for secret lookup and rotation details

## Prerequisites

- GitHub account with permissions to create organizations
- GitHub CLI (`gh`) installed and authenticated: `gh auth login`
- Organization members identified with their GitHub usernames

## Step 1: Create Organization

1. Navigate to <https://github.com/organizations/new>
2. Fill in organization details:
   - **Organization name**: `templjs`
   - **Contact email**: [your-email@example.com]
   - **Account type**: Free (can upgrade later if needed)
3. Click "Create organization"
4. Organization URL: <https://github.com/templjs>

## Step 2: Configure Organization Settings

### General Settings

1. Navigate to <https://github.com/organizations/templjs/settings/profile>
2. Configure:
   - **Display name**: `TemplJS`
   - **Description**: `Meta-templating system for structured data with TypeScript`
   - **Website**: `https://templjs.org` (or GitHub Pages URL)
   - **Email**: [public-contact@example.com]
   - **Location**: [Optional]
   - **Profile picture**: Upload templjs logo (if available)

### Security Settings

1. Navigate to <https://github.com/organizations/templjs/settings/security>
2. Enable required settings:
   - ✅ **Require two-factor authentication** for all members
   - ✅ **Enable GitHub Advanced Security** (if available on plan)
   - ✅ **Enable Dependabot alerts** for all repositories
   - ✅ **Enable Dependabot security updates**
   - ✅ **Enable CodeQL analysis** (for alerts visibility only)
3. Configure allowed permissions:
   - Set default repository permissions: **Read** (explicit write access via teams)
   - Allow members to create repositories: **No** (controlled by admins)

### Member Privileges

1. Navigate to <https://github.com/organizations/templjs/settings/member_privileges>
2. Configure:
   - **Base permissions**: Read
   - **Repository creation**: Disabled for members (admins only)
   - **Repository forking**: Enabled for public repos
   - **Pages creation**: Enabled

## Step 3: Add Team Members

### Create Teams

1. Navigate to <https://github.com/orgs/templjs/teams>
2. Create teams with appropriate access levels:

#### Core Team (Maintainers)

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /orgs/templjs/teams \
  -f name='maintainers' \
  -f description='Core maintainers with full repository access' \
  -f privacy='closed'
```

- **Name**: `maintainers`
- **Description**: Core maintainers with full repository access
- **Permission**: **Admin**
- **Members**: [Add core team members]

#### Contributors Team

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /orgs/templjs/teams \
  -f name='contributors' \
  -f description='Active contributors with write access' \
  -f privacy='closed'
```

- **Name**: `contributors`
- **Description**: Active contributors with write access
- **Permission**: **Write**
- **Members**: [Add trusted contributors]

#### Documentation Team

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /orgs/templjs/teams \
  -f name='documentation' \
  -f description='Documentation maintainers' \
  -f privacy='closed'
```

- **Name**: `documentation`
- **Description**: Documentation maintainers
- **Permission**: **Write** (with focus on docs/ directory)
- **Members**: [Add documentation contributors]

### Invite Members

```bash
# Invite members to organization
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /orgs/templjs/memberships/USERNAME \
  -f role='member'

# Add members to teams
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /orgs/templjs/teams/TEAM_SLUG/memberships/USERNAME
```

## Step 4: Create Repository

```bash
# Create repository under organization
gh repo create templjs/templ.js \
  --public \
  --description "Meta-templating system for structured data with TypeScript" \
  --enable-issues \
  --enable-wiki=false
```

Or via web interface:

1. Navigate to <https://github.com/organizations/templjs/repositories/new>
2. Fill in repository details:
   - **Repository name**: `templ.js`
   - **Description**: Meta-templating system for structured data with TypeScript
   - **Visibility**: Public
   - **Initialize**: Do not initialize (will push existing code)
3. Click "Create repository"

## Step 5: Configure Repository Settings

### General Repository Settings

1. Navigate to `https://github.com/templjs/templ.js/settings`
2. Configure:
   - ✅ **Issues** enabled
   - ❌ **Wiki** disabled
   - ❌ **Sponsorships** disabled (enable later if needed)
   - ❌ **Projects** disabled (use GitHub Projects separately)
   - ❌ **Preserve this repository** (archive protection)

### Pull Requests

1. Navigate to `https://github.com/templjs/templ.js/settings/branches`
2. Scroll to "Pull Requests" section:
   - ❌ **Allow merge commits** (disabled - requires conventional commits)
   - ✅ **Allow squash merging** (default merge method)
   - ❌ **Allow rebase merging** (disabled)
   - ✅ **Always suggest updating pull request branches**
   - ✅ **Automatically delete head branches**
   - ✅ **Allow auto-merge**

### Code Scanning

The repository includes a custom CodeQL workflow (`.github/workflows/codeql.yml`) with Advanced setup.

**After merging the initial PR to main**:

1. Navigate to `https://github.com/templjs/templ.js/settings/security_analysis`
2. GitHub will automatically recognize the custom `codeql.yml` workflow
3. CodeQL will show as "Advanced" mode (not "Default")
4. Keep **"Block pull requests when code scanning results are available"** enabled
5. The workflow uses `wait-for-processing: true` to prevent race conditions

**Why Advanced?** The custom workflow includes explicit build steps (`pnpm install && pnpm build`) required for accurate analysis of TypeScript monorepo packages.

## Step 6: Setup Shared Long-Lived Branch Ruleset

### Automated Setup (Recommended)

Use the provided script to create or update one shared repository ruleset plus two branch-specific merge-method rulesets:

```bash
cd /Users/macos/dev/templjs
./.github/scripts/setup-branch-protection.sh templjs templ.js
```

Default behavior:

- creates or updates a ruleset named `protect-long-lived-branches`
- targets branch refs matching `refs/heads/*[!/]*`
- applies the same required PR and status-check rules to slashless long-lived branches such as `main` and `staging`
- creates or updates `protect-staging-merge-method` for `refs/heads/staging`
- creates or updates `protect-main-merge-method` for `refs/heads/main`
- excludes short-lived topic branches such as `feature/...`, `fix/...`, and `chore/...`
- restricts merge methods as follows:
  - `staging`: `squash` only
  - `main`: `rebase` only

Optional explicit invocation:

```bash
./.github/scripts/setup-branch-protection.sh \
  templjs \
  templ.js \
  'refs/heads/*[!/]*' \
  'protect-long-lived-branches'
```

### Manual Setup

Create three branch rulesets.

#### A. Shared Long-Lived Branch Ruleset

1. Navigate to `https://github.com/templjs/templ.js/settings/rules`
2. Click **New ruleset** and choose **New branch ruleset**
3. Configure:
   - **Ruleset name**: `protect-long-lived-branches`
   - **Enforcement status**: Active
   - **Target branches by pattern**:
     - include: `refs/heads/*[!/]*`
     - exclude: none

4. Add rules:
   - ✅ Block branch creation outside the ruleset policy
   - ✅ Block direct branch updates that bypass pull request flow
   - ✅ Block branch deletion
   - ✅ Block non-fast-forward updates
   - ✅ **Require a pull request before merging**
   - ✅ Require approvals: **1**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ❌ Require review from Code Owners (enable when CODEOWNERS exists)
   - ✅ Require approval of the most recent reviewable push
   - ✅ Require conversation resolution before merging
   - ✅ Allowed merge methods:
     - `squash`
     - `rebase`
   - ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - **Required status checks** (add them after the workflows have run at least once):
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
   - ✅ **Require linear history**
   - ✅ Enable Copilot code review:
     - review on push: enabled
     - review draft pull requests: disabled
   - ❌ CodeQL and Benchmark checks should remain informational

5. Keep bypass actors empty unless you intentionally want exceptions
6. Save the ruleset

#### B. Staging Merge-Method Ruleset

1. Create another **branch ruleset**
2. Configure:
   - **Ruleset name**: `protect-staging-merge-method`
   - **Enforcement status**: Active
   - **Target branches by pattern**:
     - include: `refs/heads/staging`
     - exclude: none
3. Add only the pull request rule:
   - ✅ **Require a pull request before merging**
   - ✅ Require approvals: **1**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ❌ Require review from Code Owners
   - ✅ Require approval of the most recent reviewable push
   - ✅ Require conversation resolution before merging
   - ✅ Allowed merge methods:
     - `squash`
4. Save the ruleset

#### C. Main Merge-Method Ruleset

1. Create another **branch ruleset**
2. Configure:
   - **Ruleset name**: `protect-main-merge-method`
   - **Enforcement status**: Active
   - **Target branches by pattern**:
     - include: `refs/heads/main`
     - exclude: none
3. Add only the pull request rule:
   - ✅ **Require a pull request before merging**
   - ✅ Require approvals: **1**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ❌ Require review from Code Owners
   - ✅ Require approval of the most recent reviewable push
   - ✅ Require conversation resolution before merging
   - ✅ Allowed merge methods:
     - `rebase`
4. Save the ruleset

Notes:

- `refs/heads/*[!/]*` is intended for slashless long-lived branches such as `main` and `staging`
- topic branches like `feature/...` or `fix/...` are managed by PR flow, not by this shared long-lived-branch ruleset
- `Require Changeset` should remain required for contributor PRs; the workflow skips the automated Changesets version PR automatically
- the shared ruleset allows `squash` and `rebase`, but the branch-specific rulesets narrow this further
- `staging` should use `squash` to keep prerelease integration history PR-shaped and easy to bisect
- `main` should use `rebase` so promotion from `staging` preserves the already-curated linear commit sequence without merge commits

## Step 8: Configure Secrets

Secrets are required for CI/CD workflows. Add them via:

```bash
# VS Code Marketplace publisher token
gh secret set VSCODE_PUBLISHER_TOKEN --org templjs

# Codecov token for coverage reporting
gh secret set CODECOV_TOKEN --org templjs
```

Or manually at: `https://github.com/organizations/templjs/settings/secrets/actions`

### Configure NPM Trusted Publishing

NPM now supports [Trusted Publishing](https://docs.npmjs.com/trusted-publishers), which eliminates the need for NPM tokens:

**Note**: Trusted publishing must be configured per published package. For this repo, that means:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

Each package must exist on npmjs.com before configuring its trusted publisher. If a package does not exist yet:

```bash
# NOTE: You _must_ already be logged into an existing npmjs.com account from the command line (`npm login`)
# Example dry run for a package
pnpm --filter @templjs/core publish --access public --tag latest --dry-run
```

Once each package exists:

1. Navigate to the package settings page on npm, for example:
   - <https://www.npmjs.com/package/@templjs/core/settings/access>
2. Under "Publishing", configure GitHub as a trusted publisher:
   - **GitHub repository**: `templjs/templ.js`
   - **Workflow filename**: `release.yml`
   - **Environment names**:
     - `prerelease` for automated staging publishes
     - `release` for stable tag-based publishes
3. Repeat for each published package
4. Save the trusted publisher configuration

Your CI/CD workflows can now publish to npm without storing tokens as secrets.

### Required Secrets

1. **NPM_TOKEN** (Legacy - to be replaced with Trusted Publishing)
   - Purpose: Publish packages to npm registry (use Trusted Publishing instead)
   - How to obtain: <https://www.npmjs.com/settings/~/tokens>
   - Scope: Automation token with publish access
   - Status: Deprecated in favor of Trusted Publishing
2. **VSCODE_PUBLISHER_TOKEN**
   - Purpose: Publish VS Code extension to marketplace
   - How to obtain: <https://dev.azure.com/> → Personal Access Tokens
   - Scope: Marketplace (publish)
3. **CODECOV_TOKEN**
   - Purpose: Upload code coverage reports
   - How to obtain: <https://codecov.io/gh/templjs/templ.js/settings>
   - Required for private repos only (optional for public)

## Step 8a: Configure Release Environments

The release workflow uses two GitHub environments.

1. Navigate to `https://github.com/templjs/templ.js/settings/environments`
2. Create an environment named `prerelease`
3. Recommended settings for `prerelease`:
   - No required reviewers by default
   - Optional deployment branch restriction:
     - branch `staging`
4. Create an environment named `release`
5. Recommended settings for `release`:
   - Optional required reviewers: maintainers team
   - Optional deployment tag restrictions:
     - tags matching `v*`
     - tags matching `vscode-v*`
6. Keep the environment secrets empty unless you intentionally want environment-scoped overrides

## Step 8b: Configure Tag Rules

Protect both release tag lanes so only maintainers can create them:

1. Navigate to `https://github.com/templjs/templ.js/settings/rules`
2. Add tag protection or repository rulesets for:
   - `v*`
   - `vscode-v*`
3. Restrict tag creation to the maintainers team
4. Keep the shared long-lived branch ruleset separate from tag protection

## Step 9: Enable GitHub Pages

### Automated Setup

1. create the `gh-pages` branch on GitHub:

   ```bash
   # Create gh-pages branch based on main and push to GitHub

   git checkout main
   git checkout -b gh-pages
   git push -u origin gh-pages

   # Or create the branch directly on GitHub using gh CLI:
   gh api \
   -X POST \
   -H "Accept: application/vnd.github+json" \
   /repos/templjs/templ.js/git/refs \
   -f ref='refs/heads/gh-pages' \
   -f sha=$(gh api /repos/templjs/templ.js/commits/main --jq .sha)
   ```

2. Enable GitHub Pages

   ```bash
   gh api \
   --method POST \
   -H "Accept: application/vnd.github+json" \
   /repos/templjs/templ.js/pages \
   -f 'source[branch]=gh-pages' \
   -f 'source[path]=/'
   ```

### Manual Setup

1. Navigate to `https://github.com/templjs/templ.js/settings/pages`
2. Configure:
   - **Source**: Deploy from a branch
   - **Branch**: `gh-pages` → `/ (root)`
   - **Custom domain**: `templjs.org` (optional)
3. Click "Save"
4. GitHub Pages will be available at: `https://templjs.github.io/templ.js/`

## Step 10: Push Initial Code

```bash
cd /Users/macos/dev/templjs
git remote add origin https://github.com/templjs/templ.js.git
git branch -M main
git push -u origin main
```

## Step 11: Verification Checklist

- [x] Organization visible at <https://github.com/templjs>
- [x] Organization profile configured with logo, description, website
- [x] Two-factor authentication enforced for all members
- [x] Teams created: maintainers, contributors, documentation
- [x] Repository created: `templjs/templ.js`
- [x] Repository is public with issues enabled
- [x] Shared long-lived branch ruleset active for `main` and `staging`
- [x] Secrets configured: ~~NPM_TOKEN~~, VSCODE_PUBLISHER_TOKEN, CODECOV_TOKEN
- [x] GitHub Pages enabled (if applicable)
- [x] Initial code pushed to `main` branch
- [ ] Issue templates visible when creating new issues
- [ ] PR template auto-populates when creating PRs

## Troubleshooting

### Cannot create organization

- **Issue**: "Organization name is already taken"
- **Solution**: Choose alternative name (e.g., `templjs-org`, `templ-js`)

### Cannot enforce 2FA

- **Issue**: Some members don't have 2FA enabled
- **Solution**: Remove non-compliant members, re-invite after they enable 2FA

### Shared branch ruleset not working

- **Issue**: A long-lived branch is not being gated as expected
- **Solution**: Verify the ruleset is active, confirm the include pattern matches the branch ref, and check for bypass actors or overlapping rulesets

### Secrets not available in workflows

- **Issue**: Workflows fail with "secret not found"
- **Solution**: Verify secrets are set at organization level or repository level with correct names

## Additional Resources

- [GitHub Organizations Documentation](https://docs.github.com/en/organizations)
- [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

## Support

For questions or issues with organization setup, contact:

- Organization admins: [list admin contacts]
- GitHub support: <https://support.github.com/>
