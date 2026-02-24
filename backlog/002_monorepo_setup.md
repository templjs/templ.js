---
id: wi-002
type: work-item
subtype: task
lifecycle: active
title: 'WI-002: Initialize Monorepo (pnpm + Nx + TypeScript)'
status: closed
status_reason: completed
priority: critical
estimated: 8
assignee: ''
actual: 7
test_results:
  - timestamp: 2026-02-19T08:14:01.075Z
    note: Monorepo structure complete
completed_date: 2026-01-20
commits:
  6f7964c: 'feat(infra): initialize pnpm + Nx + TypeScript monorepo structure'
links:
  depends_on:
    - '[[001_github_organization]]'
  commits:
    - 'https://github.com/templjs/templ.js/commit/6f7964c'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/1'
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

- [ ] `pnpm install` completes without errors
- [ ] `pnpm nx graph` shows correct package structure
- [ ] Path aliases resolve correctly in LSP
- [ ] All packages can import from each other using workspace protocol
- [ ] `pnpm build` runs successfully (even with empty source)

## References

- REPO_SCAFFOLDING.md - Package Configuration section
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Nx Monorepo Guide](https://nx.dev/getting-started/intro)
