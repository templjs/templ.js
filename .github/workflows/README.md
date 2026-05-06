# GitHub Actions Workflows

This directory contains the canonical CI/CD workflow definitions for the templjs monorepo.

## Workflow Summary

### `draft-pr-gate.yml`

Triggers:

- pull request target events for `opened`, `reopened`, `synchronize`, and `ready_for_review` on `main` and `staging`

Behavior:

- converts newly opened or reopened non-draft PRs back to draft
- converts ready PRs with new commits back to draft so CI can rerun before review automation resumes
- allows `ready_for_review` only when all observed non-CodeRabbit checks on the PR head commit are green

Policy posture:

- keeps CodeRabbit idle while CI is still red or pending
- expects contributors to mark PRs ready only after current jobs are green

### `ci.yml`

Triggers:

- push to `main` and `staging`
- pull requests to `main` and `staging`
- nightly schedule

Key jobs:

- `Install Dependencies`
- `Lint`
- `Type Check`
- `Lint Work Item Frontmatter`
- `Require Changeset`
- matrix `Test`
- `Build`

Notes:

- contributor PRs that touch released artifacts must include a `.changeset/*.md`
- the automated version PR is exempt from the changeset guard

### `release.yml`

Triggers:

- push to `staging`
- push to `main`
- published GitHub Releases

Behavior:

- `staging`
  - computes CI-only prerelease versions
  - generates prerelease notes from the shared release-notes template and uploads them as workflow artifacts
  - publishes npm prereleases to `next`
  - publishes VS Code Marketplace prereleases
- `main`
  - maintains the Changesets version PR
- published GitHub Releases
  - `vX.Y.Z` publishes stable npm packages
  - `vscode-vX.Y.Z` publishes the stable VS Code extension

Key properties:

- four npm packages stay on one fixed train
- `vscode-templjs` versions independently
- npm publishing uses GitHub OIDC trusted publishing
- stable publishing is release-driven, not branch-push-driven
- release notes are fully mechanized from commit and pull-request messaging

### `benchmark.yml`

Triggers:

- pull requests to `main` and `staging`
- pushes to `main` and `staging`
- nightly schedule
- manual dispatch

Behavior:

- runs the deterministic benchmark harness
- uploads machine-readable artifacts
- compares PRs against the latest successful `main` baseline when available

Policy posture:

- informational on `staging`
- required on `main` promotion PRs through repository rulesets

### `codeql.yml`

Triggers:

- push to `main` and `staging`
- pull requests to `main` and `staging`
- weekly schedule

Behavior:

- runs CodeQL for `javascript-typescript`

Policy posture:

- informational on `staging`
- required on `main` promotion PRs through repository rulesets

## Versioning Model

Changesets configuration lives in [../../.changeset/config.json](../../.changeset/config.json).

- fixed npm train:
  - `@templjs/core`
  - `@templjs/cli`
  - `@templjs/volar`
  - `@templjs/context-graph`
- independent extension:
  - `vscode-templjs`

## Required Credentials

See [../SECRETS.md](../SECRETS.md).

Current workflow credentials:

- required:
  - `VSCODE_PUBLISHER_TOKEN`
- optional:
  - `CODECOV_TOKEN`
- no `NPM_TOKEN` secret is required; npm publishing uses trusted publishing

## Canonical Runbooks

- recurring release and promotion flow:
  - [../../docs/release-process.md](../../docs/release-process.md)
- one-time repo setup and rulesets:
  - [../organization-setup.md](../organization-setup.md)
- secret and credential setup:
  - [../SECRETS.md](../SECRETS.md)

## Local CI Parity

```bash
corepack enable
corepack prepare pnpm@8.15.0 --activate
pnpm install

pnpm run ci:lint
pnpm run ci:type-check
pnpm run ci:test
pnpm run ci:build
```

Use Node `24` locally unless you are explicitly testing matrix compatibility.

## Release Quick Reference

1. Merge contributor work into `staging`
2. Let `staging` publish prerelease artifacts automatically
3. Promote `staging` to `main`
4. Merge the automated version PR on `main`
5. Create a stable tag:
   - `vX.Y.Z`
   - `vscode-vX.Y.Z`
6. Publish the GitHub Release
