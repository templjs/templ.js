# GitHub Actions Secrets Configuration

This document lists all required secrets for the templjs GitHub Actions workflows.

## Required Secrets

Configure these secrets in your GitHub repository settings: Settings → Secrets and variables → Actions

### NPM Publishing

**`NPM_TOKEN`** (Required for release workflow)

- **Purpose**: Publish packages to npm under the `@templjs` scope
- **How to obtain**:
  1. Log in to npm: `npm login`
  2. Generate a token: Visit [Creating and viewing access tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
  3. Create an "Automation" token (recommended) or "Publish" token
  4. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret

### VS Code Extension Publishing

**`VSCODE_PUBLISHER_TOKEN`** (Required for VS Code extension publishing)

- **Purpose**: Publish the VS Code extension to the Visual Studio Marketplace
- **How to obtain**:
  1. Go to [Azure](https://dev.azure.com)
  2. Create a Personal Access Token (PAT) with Marketplace → Manage scope
  3. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret
- **Documentation**: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

**`OPEN_VSX_TOKEN`** (Optional for Open VSX Registry)

- **Purpose**: Publish the extension to Open VSX Registry (open-source alternative)
- **How to obtain**:
  1. Create an account at [Open VSX Registry](https://open-vsx.org)
  2. Generate an access token from your user settings
  3. Copy the token
- **Where to set**: Repository Settings → Secrets and variables → Actions → New repository secret
- **Documentation**: [Publishing Extensions](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)

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

| Secret Name              | Required    | Used In     | Purpose                      |
| ------------------------ | ----------- | ----------- | ---------------------------- |
| `NPM_TOKEN`              | Yes         | release.yml | Publish npm packages         |
| `VSCODE_PUBLISHER_TOKEN` | Yes         | release.yml | Publish VS Code extension    |
| `OPEN_VSX_TOKEN`         | No          | release.yml | Publish to Open VSX Registry |
| `CODECOV_TOKEN`          | Recommended | ci.yml      | Upload coverage reports      |

## Default GitHub Secrets

These secrets are automatically provided by GitHub:

- `GITHUB_TOKEN`: Automatically generated for each workflow run
  - Used for: Creating releases, commenting on PRs, pushing changes

## Testing Secrets Configuration

After setting up secrets, you can test them by:

1. **NPM Token**: Run the release workflow manually
2. **VSCODE_PUBLISHER_TOKEN**: Merge to a release branch
3. **CODECOV_TOKEN**: Push a commit and check if coverage uploads

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

### VS Code Extension Publishing Fails

- Verify PAT has "Marketplace: Manage" scope
- Check publisher ID exists and matches package.json
- Ensure PAT hasn't expired

### Codecov Upload Fails

- Verify repository is added to Codecov
- Check coverage files are being generated
- Ensure token is correctly set (for private repos)
