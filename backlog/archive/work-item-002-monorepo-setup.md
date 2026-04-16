---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:002-monorepo-setup
title: 'WI-002: Initialize Monorepo (pnpm + Nx + TypeScript)'
summary: 'WI-002: Initialize Monorepo (pnpm + Nx + TypeScript)'
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 8
actual: 7
commits:
  6f7964c: 'feat(infra): initialize pnpm + Nx + TypeScript monorepo structure'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/1
  evidence:
    - '[[record-002-monorepo-setup-evidence-1]]'
---

## Goal

Setup pnpm workspaces, Nx build orchestration, and TypeScript configuration for templ.js monorepo.

## Background

Project consists of 4 interdependent packages: `@templjs/core`, `@templjs/cli`, `@templjs/volar`, `vscode-templjs`. Monorepo enables atomic testing, efficient caching, and coordinated releases.

**Related ADRs**: [[ADR-005 Monorepo Structure]]

## Tasks

- [x] Initialize empty monorepo structure in `templjs/templ.js`
- [x] Create root `package.json` with workspace scripts
- [x] Create `pnpm-workspace.yaml` with package paths
- [x] Create `nx.json` with caching configuration
- [x] Create `tsconfig.base.json` with path aliases
- [x] Create package directories: `packages/core`, `packages/cli`, `packages/volar`, `extensions/vscode`
- [x] Create `package.json` for each package with proper metadata
- [x] Create `tsconfig.json` for each package extending base
- [x] Run `pnpm install` and verify workspace resolution

## Deliverables

- Complete monorepo directory structure
- All configuration files (workspace, Nx, TypeScript)
- All 4 packages with proper naming and configuration
- Verified workspace dependency resolution

## Acceptance Criteria

- [x] `pnpm install` completes without errors
- [x] `pnpm nx graph` shows correct package structure
- [x] Path aliases resolve correctly in LSP
- [x] All packages can import from each other using workspace protocol
- [x] `pnpm build` runs successfully (even with empty source)

## References

- REPO_SCAFFOLDING.md - Package Configuration section
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Nx Monorepo Guide](https://nx.dev/getting-started/intro)

## Relationships

- `depends_on`: [[work-item-001-github-organization]]
