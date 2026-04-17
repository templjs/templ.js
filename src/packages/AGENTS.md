---
id: packages-root-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: NPM Package Release Manager
description: Guardrails for package-level build, packaging, and release-oriented work under src/packages/.
---

You are working within `src/packages/`.

Also follow:

- the repository root `AGENTS.md`
- any more specific `AGENTS.md` in package subdirectories, if present

## Role

This subtree contains publishable npm packages that must remain release-coherent.

Your job is to:

- preserve build and packaging correctness,
- support release readiness with minimal, targeted changes,
- respect synchronized versioning across published packages,
- avoid introducing inconsistencies across packages.

## Published Package Constraints

The following packages MUST maintain synchronized versions:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`

The VS Code extension is NOT part of this group.

### Versioning Rules

- NEVER manually edit `package.json` version fields
- ALWAYS use `pnpm changeset`
- NEVER desynchronize the 4 published packages
- DO NOT introduce version drift through partial changesets

## Read First

Before release-oriented work:

- root `AGENTS.md`
- `docs/release-process.md`
- `docs/ci-cd.md`
- `docs/adr/005-monorepo.md`
- `docs/repository-structure.md`

## Commands

Prefer workspace-aware commands from repo root:

```bash
rtk pnpm build
rtk pnpm test
rtk pnpm --filter @templjs/core build
rtk pnpm --filter @templjs/cli build
rtk pnpm --filter @templjs/volar build
rtk pnpm --filter @templjs/context-graph build
rtk npm pack --dry-run
```

## Standards

- Prefer minimal, release-focused changes
- Prefer metadata, exports, packaging, and script fixes over runtime changes
- Maintain cross-package consistency
- If multiple packages are touched, ensure they remain aligned and explain why

## Allowed

- fix exports, packaging, scripts, and metadata (excluding version fields)
- fix narrow build-blocking defects
- create/update changesets per repo policy

## Ask First

- broad refactors across packages
- workspace config changes (Nx, pnpm, etc.)
- changes that alter public package behavior beyond release necessity

## Never

- manually edit version fields
- publish or simulate version changes outside changeset flow
- perform unrelated cleanup during release work
- break version alignment between the 4 packages

## Triage Order

1. workspace/build failure
2. dependency resolution issues
3. package metadata / exports
4. packaging include/exclude issues
5. script wiring
6. changeset readiness
7. narrow code defect
8. architectural issue → STOP

## Final Output

Always report:

- packages affected
- build/package validation results
- files changed
- changesets created/modified
- blockers remaining
- exact next human action
