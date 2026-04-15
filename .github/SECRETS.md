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

### npm Publishing

No GitHub secret is required for npm publishing.

templjs uses npm trusted publishing via GitHub Actions OIDC instead of a long-lived `NPM_TOKEN`.

Configure a trusted publisher for each published npm package:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

Before opening npm settings pages, generate the repo-derived checklist:

```bash
./.github/scripts/prepare-npm-trusted-publishing.sh
```

Optional preflight:

```bash
./.github/scripts/prepare-npm-trusted-publishing.sh --check-registry
```

For each package:

1. Ensure the package already exists on npmjs.com.
2. Run the helper script above and use the emitted package URLs and trusted publisher values.
3. Open the package settings page, for example:
   - <https://www.npmjs.com/package/@templjs/core/settings/access>
4. Under **Publishing**, add GitHub as a trusted publisher with:
   - **Repository owner**: `templjs`
   - **Repository name**: `templ.js`
   - **Workflow filename**: `release.yml`
   - **Environment name**: leave blank
5. Save the trusted publisher configuration.

Repo-specific note:

- The helper script automates the repo-side translation work and surfaces any package metadata mismatches it finds.
- `release.yml` publishes npm packages from both the `prerelease` and `release` GitHub environments.
- npm allows only one trusted publisher configuration per package, so the npm-side environment field must remain unset to allow both lanes to publish.
- See [trusted publishers](https://docs.npmjs.com/trusted-publishers) for the canonical npm reference.

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

## Secrets Summary

| Secret Name              | Required    | Used In     | Purpose                                                |
| ------------------------ | ----------- | ----------- | ------------------------------------------------------ |
| `VSCODE_PUBLISHER_TOKEN` | Yes         | release.yml | Publish VS Code prerelease and stable extension builds |
| `CODECOV_TOKEN`          | Recommended | ci.yml      | Upload coverage reports                                |

## Default GitHub Secrets

These secrets are automatically provided by GitHub:

- `GITHUB_TOKEN`: Automatically generated for each workflow run
  - Used for: Creating releases, commenting on PRs, pushing changes

## Validating Secrets Configuration

Do not use release automation as a secret smoke test. Pushing to `staging`
publishes prerelease artifacts, and publishing a GitHub Release for `vX.Y.Z`
or `vscode-vX.Y.Z` publishes stable artifacts.

Validate credentials with non-publishing checks first:

1. **npm trusted publishing**: confirm each published package trusts `templjs/templ.js` with workflow `release.yml` and no environment restriction.
2. **VSCODE_PUBLISHER_TOKEN**: run `npx --yes @vscode/vsce verify-pat <publisher>`.
3. **CODECOV_TOKEN**: push a normal commit and confirm coverage upload in CI.

Use release tags only when you are intentionally performing a real release.

## Security Best Practices

1. **Never commit secrets** to your repository
2. **Prefer OIDC over long-lived tokens** whenever a publisher supports it
3. **Use minimal scope** tokens where tokens are still required
4. **Monitor token usage** in your Azure DevOps and Codecov dashboards
5. **Revoke unused tokens** immediately

## Troubleshooting

### NPM Publishing Fails

- Verify each published package has a trusted publisher configured on npm
- Confirm the trusted publisher points to `templjs/templ.js` and `release.yml`
- Leave the npm trusted publisher environment field blank so both `staging` prereleases and stable releases can use the same workflow
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
