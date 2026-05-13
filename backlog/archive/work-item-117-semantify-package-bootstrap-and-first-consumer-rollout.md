---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:117-semantify-package-bootstrap-and-first-consumer-rollout
title: '117: Semantify Package Bootstrap and First Consumer Rollout'
summary: Bootstrap a tracked semantify package and wire one production provider path through canonical semantify APIs.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
completed_date: '2026-05-13'
priority: high
estimated: 6
actual: 6
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/118
  evidence:
    - '[[record:wi-117-merge-evidence-2026-05-13]]'
---

## Goal

Create a tracked semantify package in the monorepo and integrate one production provider path through canonical semantify services so semantic authority expansion can continue without reintroducing local derivation.

## Background

M2 (WI-067) and M3 (WI-062) are complete, but the repository currently has no tracked semantify source package in git. Only generated artifacts exist under `src/packages/semantify/` (`dist` and `coverage`), which blocks implementation of M4 from the temporary plan.

## Scope

- Bootstrap `src/packages/semantify` as a tracked workspace package with source, build, and test entrypoints.
- Add TypeScript path and workspace wiring needed for package consumption.
- Expose canonical semantify APIs (`resolveContext`, `resolveReferences`, `planCandidates`) through package exports.
- Integrate one production consumer path in language-service or Volar with thin adapter usage only.
- Add focused integration tests proving end-to-end semantify-backed behavior.

## Tasks

- [x] Create tracked semantify package scaffold (`package.json`, `src/`, `tsconfig`, build/test scripts).
- [x] Add workspace and TypeScript alias wiring for `@templjs/semantify`.
- [x] Ensure semantify public APIs are source-backed (not dist-only artifacts).
- [x] Select and implement first production consumer path (diagnostics, completion, hover, or definition).
- [x] Keep adapter boundaries thin and avoid local semantic re-derivation.
- [x] Add targeted tests for consumer path behavior and fallback handling.
- [x] Run frontmatter, package tests, and affected build validation.

## Deliverables

- Tracked semantify workspace package with source-backed exports.
- One production semantify-backed consumer path wired into runtime flow.
- Regression/integration tests validating canonical semantify path behavior.
- Evidence-ready command log for M4/M5 rollout.

## Acceptance Criteria

- [x] `@templjs/semantify` exists as a tracked source package in git and participates in workspace build/test.
- [x] At least one production provider path is semantify-backed end-to-end.
- [x] Canonical semantify APIs are used by the consumer path (`resolveContext`, `resolveReferences`, `planCandidates`) without compatibility aliases.
- [x] No new local semantic derivation is introduced in server/provider adapter layers.
- [x] Focused integration tests pass for the new semantify-backed path.

## Verification Evidence

- `rtk pnpm --filter @templjs/semantify test`
- `rtk pnpm --filter @templjs/volar test -- test/intellisense-provider.test.ts`
- `rtk pnpm --filter @templjs/semantify build`
- `rtk pnpm --filter @templjs/volar build`

## Relationships

- `depends_on`: [[work-item-062-authoritative-template-parsing-and-delimiter-parity]]
- `depends_on`: [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
- `relates_to`: [[work-item-056-context-graph-platform-epic]]
