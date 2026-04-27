# GitHub Actions Secrets Configuration

This document lists the GitHub secrets and external credentials required by the templjs workflows.

This is the credential reference.

- use [../docs/release-process.md](../docs/release-process.md) for recurring branch and release operations
- use [organization-setup.md](./organization-setup.md) for one-time repository and environment setup

Release-note source of truth (fully mechanized):

- pull request title/body messaging (including `Release note:` lines)
- commit subject/body messaging
- release note templates in `scripts/release/templates/*.md.tmpl`

Release automation follows a branch-aware model:

- pushes to `staging` publish prerelease artifacts automatically
  - npm packages publish to dist-tag `next`
  - the VS Code extension publishes as a Marketplace prerelease
- pushes to `main` maintain the Changesets version PR
- published GitHub Releases created from stable tags on `main` publish stable artifacts
  - `vX.Y.Z` tags publish npm package releases
  - `vscode-vX.Y.Z` tags publish VS Code extension releases

## Required Secrets

Configure these secrets in GitHub: `Settings -> Secrets and variables -> Actions`.

### npm Publishing

No npm token secret is required.

templjs uses npm trusted publishing through GitHub Actions OIDC:

- workflow: `.github/workflows/release.yml`
- GitHub environments:
  - `prerelease`
  - `release`
- required GitHub job permission:
  - `id-token: write`

Manual npm setup is still required once per package:

1. Run `./.github/scripts/prepare-npm-trusted-publishing.sh`
2. Open each printed npm package settings page
3. Add GitHub as a trusted publisher
4. Use:
   - owner: `templjs`
   - repository: `templ.js`
   - workflow filename: `release.yml`
   - environment name: leave blank

Published npm packages:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

### VS Code Extension Publishing

**`VSCODE_PUBLISHER_TOKEN`** (Required)

- Purpose: publish the VS Code extension to the Visual Studio Marketplace
- Where used: `release.yml`
- How to obtain:
  1. Go to <https://dev.azure.com>
  2. Create a Personal Access Token with `Marketplace -> Manage`
  3. Ensure the PAT owner is a member of the `templjs` publisher with publish access
  4. Copy the token
- Where to set: repository Actions secrets
- Reference: <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>

Versioning note:

- `staging` prereleases use CI-generated plain semver versions
- stable releases use `vscode-vX.Y.Z` tags on `main`
- prerelease and stable publishes must not reuse the same extension version

### Backlog Automation

**`DOC_VADER_CHECKOUT_TOKEN`** (Required for backlog automation)

- Purpose: checkout the private `calan-co/doc-vader` tooling used by `backlog-automation.yml` to ingest PR and CI events into backlog work items
- Where used: `backlog-automation.yml`
- How to obtain:
  1. Go to <https://github.com/settings/tokens?type=beta> (fine-grained PAT) or <https://github.com/settings/tokens> (classic PAT)
  2. Create a token with at minimum **Contents: Read** access on the `calan-co/doc-vader` repository
  3. Copy the token
- Where to set: repository Actions secrets (`Settings → Secrets and variables → Actions`)
- Effect when absent: all Backlog Automation workflow runs will complete as skipped with a warning; no work item status updates will occur

### Code Coverage

**`CODECOV_TOKEN`** (Optional but recommended)

- Purpose: upload test coverage reports to Codecov
- Where used: `ci.yml`
- How to obtain:
  1. Sign in at <https://codecov.io>
  2. Add the repository
  3. Copy the upload token from repository settings
- Where to set: repository Actions secrets

## Secrets Summary

| Secret Name                | Required    | Used In                  | Purpose                            |
| -------------------------- | ----------- | ------------------------ | ---------------------------------- |
| `VSCODE_PUBLISHER_TOKEN`   | Yes         | `release.yml`            | Publish VS Code extension          |
| `DOC_VADER_CHECKOUT_TOKEN` | Yes         | `backlog-automation.yml` | Checkout private doc-vader tooling |
| `CODECOV_TOKEN`            | Recommended | `ci.yml`                 | Upload coverage reports            |

## Default GitHub Secrets

These are provided automatically by GitHub:

- `GITHUB_TOKEN`
  - used for: version PR maintenance, release updates, PR comments, artifact metadata

## Validation

Do not use stable tags as a credential smoke test. A published GitHub Release from `vX.Y.Z` or `vscode-vX.Y.Z` will attempt a real stable release.

Use non-publishing checks first:

1. npm trusted publishing:
   - run `./.github/scripts/prepare-npm-trusted-publishing.sh`
   - verify the printed package list and trusted-publisher values
2. VS Code publisher token:
   - run `npx --yes @vscode/vsce verify-pat templjs`
3. Codecov:
   - push a normal commit and confirm coverage upload in CI

Use real release tags only when intentionally performing a release.

## Troubleshooting

### npm Publishing Fails

- Verify trusted publishing is configured for each `@templjs/*` package
- Verify the trusted publisher points to `templjs/templ.js`
- Verify the trusted publisher workflow filename is `release.yml`
- Leave the trusted publisher environment name blank so both `prerelease` and `release` jobs can publish
- Ensure the `@templjs` scope and package names already exist on npm when required

### VS Code Publishing Fails

- Verify the PAT has `Marketplace: Manage`
- Verify the PAT owner has permission under the `templjs` publisher
- Ensure the PAT is not expired
- For `staging`, remember the workflow computes an ephemeral plain semver prerelease version in CI
- For stable releases, ensure `src/extensions/vscode/package.json` matches the `vscode-vX.Y.Z` tag exactly

### Codecov Upload Fails

- Verify the repository is configured in Codecov
- Verify coverage artifacts are generated
- Verify `CODECOV_TOKEN` is set when required
