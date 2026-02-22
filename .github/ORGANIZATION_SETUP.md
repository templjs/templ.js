# GitHub Organization Setup Guide

This document outlines the manual steps required to set up the `templjs` GitHub organization. While some tasks can be automated (see [setup-branch-protection.sh](scripts/setup-branch-protection.sh)), others require manual configuration through the GitHub web interface.

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

## Step 5: Disable Native CodeQL Enforcement

CodeQL scanning is enabled for visibility, but enforcement happens via the CI/CD workflow to avoid race conditions.

1. Navigate to `https://github.com/templjs/templ.js/settings/security_analysis`
2. Find the **CodeQL analysis** section under "Tools"
3. Click the **...** menu and select **"Advanced setup"** or scroll to "Code scanning"
4. Locate **"Block pull requests when code scanning results are available"**
5. **Uncheck this option** to disable native enforcement
6. Save changes

**Why?** Your `codeql.yml` workflow with `wait-for-processing: true` is now the authoritative enforcement point, preventing the race condition where the native check ran before SARIF processing completed.

## Step 6: Configure Repository Settings

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

## Step 7: Setup Branch Protection Rules

### Automated Setup (Recommended)

Use the provided script to automate branch protection:

```bash
cd /Users/macos/dev/templjs
./.github/scripts/setup-branch-protection.sh templjs templ.js
```

### Manual Setup

1. Navigate to `https://github.com/templjs/templ.js/settings/branches`
2. Click "Add branch protection rule"
3. Configure for `main` branch:

   **Branch name pattern**: `main`

   **Protect matching branches**:
   - ✅ **Require a pull request before merging**
   - ✅ Require approvals: **1**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ❌ Require review from Code Owners (enable when CODEOWNERS file exists)
   - ✅ Require approval of the most recent reviewable push
   - ❌ Require conversation resolution before merging
   - ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - **Status checks required** (add as they become available):
     - `Install Dependencies`
     - `Lint`
     - `Type Check`
     - `Lint Work Item Frontmatter`
     - `Test (Node 18)`
     - `Test (Node 20)`
     - `Build`
     - **Note**: CodeQL enforcement is handled by the `codeql.yml` workflow, not the native enforcement check
   - ✅ **Require signed commits**
   - ✅ **Require linear history**
   - ✅ **Require deployments to succeed before merging** (if deploying to GitHub Pages)
   - ❌ **Lock branch** (keep branch open for commits via PRs)
   - ❌ **Do not allow bypassing the above settings** (allow admins to bypass in emergencies)
   - ✅ **Restrict who can push to matching branches**
   - **Restrict pushes that create matching branches**: maintainers team only

4. Click "Create" to save the protection rule

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

**Note**: The `templ.js` package must exist on npmjs.com before configuring trusted publishers. If the package doesn't exist yet:

```bash
# NOTE: You _must_ already be logged into an existing npmjs.com account from the command line (`npm login`)
# Create a placeholder package (automated)
# 1. npx setup-npm-trusted-publish templ.js
# Create a placeholder package (manually)
# 1. Ensure package.json is configured with private: false
# 2. Run: npm publish --dry-run
# 3. Once ready to publish: npm publish
```

Once the package exists:

1. Navigate to <https://www.npmjs.com/package/templ.js/settings/access>
2. Under "Publishing", configure GitHub as a trusted publisher:
   - **GitHub repository**: `templjs/templ.js`
   - **Workflow filename**: `publish.yml`
   - **Environment name**: `npm` (optional, for additional protection)
3. Save the trusted publisher configuration

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
- [x] Branch protection active on `main` branch
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

### Branch protection not working

- **Issue**: Commits pushed directly to `main`
- **Solution**: Ensure "Restrict who can push" is enabled and no admin bypass exceptions

### Secrets not available in workflows

- **Issue**: Workflows fail with "secret not found"
- **Solution**: Verify secrets are set at organization level or repository level with correct names

## Additional Resources

- [GitHub Organizations Documentation](https://docs.github.com/en/organizations)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

## Support

For questions or issues with organization setup, contact:

- Organization admins: [list admin contacts]
- GitHub support: <https://support.github.com/>
