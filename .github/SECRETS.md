# GitHub Actions Secrets Configuration

This document lists all required secrets for the templjs GitHub Actions workflows.

This document is the credential reference.

- use [../docs/release-process.md](../docs/release-process.md) for the recurring branch and release workflow
- use [organization-setup.md](./organization-setup.md) for one-time GitHub, environment, and protection setup

Release automation now follows a branch-aware model:

- Pushes to `staging` publish prerelease artifacts automatically:
  - npm packages publish to dist-tag `next`
  - VS Code publishes as Marketplace prereleases
- Pushes to `main` maintain the Changesets version pull request.
- Published GitHub Releases created from stable release tags on `main` publish stable artifacts:
  - `vX.Y.Z` tags publish npm package releases
  - `vscode-vX.Y.Z` tags publish VS Code extension releases

## Required Secrets

Configure these secrets in your GitHub repository settings: Settings → Secrets and variables → Actions

### NPM Publishing

**`NPM_TOKEN`** (Optional fallback for npm publishing)

- **Purpose**: Publish packages to npm under the `@templjs` scope and maintain `next`/`latest` dist-tags when npm trusted publishing is not configured
- **How to obtain**:
  1. Log in to npm: `npm login`
  2. Generate a token: Visit [Creating and viewing access tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
  3. Create an "Automation" token (recommended) or "Publish" token
  4. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret

### Preferred npm Publishing Setup

**Trusted publishing via GitHub OIDC** (Preferred, no secret required)

- **Purpose**: Let GitHub Actions publish to npm without storing a long-lived npm token in repository secrets
- **How to configure**:
  1. In npm, configure this repository as a trusted publisher
  2. Ensure the workflow has `id-token: write` permission
  3. Allow publishing from GitHub Actions runs in this repository
  4. Configure both workflow environments used by release automation:
     - `prerelease`
     - `release`
- **Why preferred**:
  - no long-lived publish token stored in GitHub
  - better provenance and maintainability
  - simpler secret rotation story
- **Fallback**: If trusted publishing is not available yet, keep `NPM_TOKEN` configured

### VS Code Extension Publishing

**`VSCODE_PUBLISHER_TOKEN`** (Required for VS Code extension publishing)

- **Purpose**: Publish the VS Code extension to the Visual Studio Marketplace via packaged VSIX artifacts
- **How to obtain**:
  1. Go to [Azure](https://dev.azure.com)
  2. Create a Personal Access Token (PAT) with Marketplace → Manage scope
  3. Ensure the PAT user is a member of the `templjs` publisher with publish permissions
  4. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret
- **Documentation**: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- **Important versioning note**:
  - VS Code prerelease and stable extension publishes should use different plain semver versions
  - `staging` prereleases use CI-generated next-minor plain semver versions
  - `vscode-vX.Y.Z` tags on `main` are for stable releases only

### Code Coverage

**`CODECOV_TOKEN`** (Optional but recommended)

- **Purpose**: Upload test coverage reports to Codecov
- **How to obtain**:
  1. Sign up at [Codecov](https://codecov.io) with your GitHub account
  2. Add your repository
  3. Copy the upload token from repository settings
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret
- **Note**: While Codecov can auto-detect public repositories, using a token is more reliable and required for private repositories

### Backlog Automation Source Access

**`DOC_VADER_CHECKOUT_TOKEN`** (Required to enable backlog automation against the private `doc-vader` source repository)

- **Purpose**: Allow the `backlog-automation.yml` workflow to checkout `squirrel289/doc-vader`
- **How to obtain**:
  1. Create a fine-grained GitHub personal access token
  2. Grant read access to the private `squirrel289/doc-vader` repository
  3. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret
- **Behavior when unset**:
  - backlog automation jobs are skipped cleanly
  - PRs and CI remain mergeable without a failing automation check

## Secrets Summary

| Secret Name                | Required    | Used In                | Purpose                                                        |
| -------------------------- | ----------- | ---------------------- | -------------------------------------------------------------- |
| `NPM_TOKEN`                | Fallback    | release.yml            | Publish npm packages when trusted publishing is not configured |
| `VSCODE_PUBLISHER_TOKEN`   | Yes         | release.yml            | Publish VS Code prerelease and stable extension builds         |
| `CODECOV_TOKEN`            | Recommended | ci.yml                 | Upload coverage reports                                        |
| `DOC_VADER_CHECKOUT_TOKEN` | Optional    | backlog-automation.yml | Checkout private `doc-vader` source for backlog automation     |

## Default GitHub Secrets

These secrets are automatically provided by GitHub:

- `GITHUB_TOKEN`: Automatically generated for each workflow run
  - Used for: Creating releases, commenting on PRs, pushing changes

## Validating Secrets Configuration

Do not use release tags as a secret smoke test. Pushing `pre-vX.Y.Z` or `vX.Y.Z`
will publish artifacts to npm and VS Code Marketplace.

Validate credentials with non-publishing checks first:

1. **NPM Token**: run `npm whoami` in an authenticated shell.
2. **VSCODE_PUBLISHER_TOKEN**: run `npx --yes @vscode/vsce verify-pat <publisher>`.
3. **CODECOV_TOKEN**: push a normal commit and confirm coverage upload in CI.

Use release tags only when you are intentionally performing a real release.

## Security Best Practices

1. **Never commit secrets** to your repository
2. **Rotate tokens** periodically (every 6-12 months)
3. **Use minimal scope** tokens (e.g., "Publish" not "Full Access")
4. **Monitor token usage** in your npm/Azure DevOps dashboards
5. **Revoke unused tokens** immediately

## Troubleshooting

### NPM Publishing Fails

- If using `NPM_TOKEN`, verify the token has "Publish" scope
- If using trusted publishing, verify npm trusted publisher configuration matches this repository/workflow
- Check package names aren't already taken
- Ensure `@templjs` scope is registered to your npm account
- For `staging` prereleases, packages publish to npm dist-tag `next`
- For stable package releases from `main`, packages publish to npm dist-tag `latest`

### VS Code Extension Publishing Fails

- Verify PAT has "Marketplace: Manage" scope
- Check publisher ID exists and matches package.json
- Ensure PAT hasn't expired
- For `staging`, remember the workflow computes an ephemeral plain semver prerelease version in CI
- For stable releases, ensure the tagged version in `src/extensions/vscode/package.json` matches the `vscode-vX.Y.Z` release tag and is plain semver (`X.Y.Z`)
- Ensure prerelease and stable publishes use distinct plain semver versions
- The workflow packages the extension with `vsce package --no-dependencies` and publishes from `--packagePath`

### Codecov Upload Fails

- Verify repository is added to Codecov
- Check coverage files are being generated
- Ensure token is correctly set (for private repos)
