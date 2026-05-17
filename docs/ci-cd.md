---
id: cicd-001
type: document
subtype: guide
lifecycle: active
status: ready
title: CI/CD Infrastructure
---

## CI/CD Infrastructure

This document is the high-level reference for templjs CI/CD. Use it as the map; use the linked runbooks for operating detail.

Canonical companions:

- [Release Process](./release-process.md)
- [GitHub Actions Workflows](../.github/workflows/README.md)
- [GitHub Organization Setup](../.github/organization-setup.md)
- [Secrets Configuration](../.github/SECRETS.md)

## Branch Roles

- `staging`
  - prerelease integration branch
  - automatic prerelease publishing
- `main`
  - stable promotion branch
  - automated Changesets version PR maintenance
  - only source for stable release tags

## Required Checks

Shared long-lived branch checks:

- `Install Dependencies`
- `Lint`
- `Type Check`
- `Lint Work Item Frontmatter`
- `Require Changeset`
- `Require Release Metadata`
- `Docs API Guard`
- all required `Test` matrix jobs
- `Build`

Additional `main`-only gates:

- `Benchmark Suite`
- `Analyze (javascript-typescript)`

Interpretation:

- benchmark and CodeQL run on both `staging` and `main`
- they are informational on `staging`
- they are promotion gates on `main`

## Workflow Roles

- `ci.yml`
  - core validation for pushes and PRs to `staging` and `main`
- `release.yml`
  - prerelease publishing from `staging`
  - version PR maintenance on `main`
  - stable publishing from published GitHub Releases
- `benchmark.yml`
  - deterministic benchmark execution and PR comparison
- `codeql.yml`
  - repository security analysis

## Publishing Model

Prereleases:

- source branch: `staging`
- npm channel: `next`
- VS Code channel: Marketplace prerelease
- versions: CI-generated and ephemeral

Stable releases:

- source branch: `main`
- npm tags: `vX.Y.Z`
- VS Code tags: `vscode-vX.Y.Z`
- versions: Changesets-authored and committed via the version PR

## Versioning Model

Public npm package set:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`
- `@templjs/language-core`
- `@templjs/language-service`
- `@templjs/language-server`
- `@templjs/semantify`

Fixed synchronized train:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

Independent extension:

- `vscode-templjs`

## Credentials

- npm: trusted publishing via GitHub OIDC
- VS Code: `VSCODE_PUBLISHER_TOKEN`
- coverage: optional `CODECOV_TOKEN`
