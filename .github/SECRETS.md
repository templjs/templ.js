# GitHub Actions Secrets Configuration

This document lists all required secrets for the templjs GitHub Actions workflows.

Release automation now follows a two-stage model:

- Pushes to `main` maintain the Changesets version pull request.
- Tags created from `main` publish artifacts:
  - `pre-vX.Y.Z` publishes prerelease artifacts
  - `vX.Y.Z` publishes stable artifacts

## Required Secrets

Configure these secrets in your GitHub repository settings: Settings → Secrets and variables → Actions

### NPM Publishing

**`NPM_TOKEN`** (Required for tag-driven npm publishing)

- **Purpose**: Publish packages to npm under the `@templjs` scope and maintain `next`/`latest` dist-tags during tagged releases
- **How to obtain**:
  1. Log in to npm: `npm login`
  2. Generate a token: Visit [Creating and viewing access tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
  3. Create an "Automation" token (recommended) or "Publish" token
  4. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret

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

### Code Coverage

**`CODECOV_TOKEN`** (Optional but recommended)

- **Purpose**: Upload test coverage reports to Codecov
- **How to obtain**:
  1. Sign up at [Codecov](https://codecov.io) with your GitHub account
  2. Add your repository
  3. Copy the upload token from repository settings
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret
- **Note**: While Codecov can auto-detect public repositories, using a token is more reliable and required for private repositories

## Secrets Summary

| Secret Name              | Required    | Used In     | Purpose                   |
| ------------------------ | ----------- | ----------- | ------------------------- |
| `NPM_TOKEN`              | Yes         | release.yml | Publish npm packages      |
| `VSCODE_PUBLISHER_TOKEN` | Yes         | release.yml | Publish VS Code extension |
| `CODECOV_TOKEN`          | Recommended | ci.yml      | Upload coverage reports   |

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

- Verify token has "Publish" scope
- Check package names aren't already taken
- Ensure `@templjs` scope is registered to your npm account
- For prerelease tags (`pre-vX.Y.Z`), packages publish to npm dist-tag `next`
- For stable tags (`vX.Y.Z`), packages publish to npm dist-tag `latest`

### VS Code Extension Publishing Fails

- Verify PAT has "Marketplace: Manage" scope
- Check publisher ID exists and matches package.json
- Ensure PAT hasn't expired
- Ensure the tagged version in `src/extensions/vscode/package.json` is plain semver (`X.Y.Z`), not a prerelease suffix
- The workflow packages the extension with `vsce package --no-dependencies` and publishes from `--packagePath`

### Codecov Upload Fails

- Verify repository is added to Codecov
- Check coverage files are being generated
- Ensure token is correctly set (for private repos)
