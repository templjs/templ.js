---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:107-esm-server-bundle-spike-and-migration-plan
title: '107: ESM server bundle migration spike results and phased path forward'
summary: Capture the completed VS Code extension server ESM bundling spike, document the runtime blockers found in the current CJS-oriented launch/compat layer, and define a phased migration plan that preserves release safety while moving toward TypeScript ESM-first implementation.
type: work-item
subtype: task
lifecycle: active
status: in-progress
priority: medium
estimated: 4
actual: 3
links:
  evidence:
    - https://github.com/templjs/templ.js/blob/staging/backlog/records/record-107-esm-server-bundle-spike-evidence-1.md
---

## Goal

Record verified spike evidence for switching the extension server bundle from CJS to ESM, then define a low-risk, incremental execution plan that can be implemented and validated without destabilizing extension packaging or runtime startup.

## Background

A focused spike was run against `src/extensions/vscode/scripts/build.mjs` by temporarily changing esbuild output format from `cjs` to `esm`.

### Verified spike outcomes

- ESM bundle generation succeeds for both `dist/extension.js` and `dist/server.js`.
- Runtime loading fails under current assumptions because bundled code still uses CJS-compat patterns, including `createRequire(__filename)`.
- The failing path appears in the server bundle where `createRequire(__filename)` is emitted by compatibility rewriting that is valid for CJS but invalid in ESM execution context.
- Existing CJS build path was restored and validated successfully after the spike.

### Why this blocks a one-line `format: 'esm'` switch

The current extension/server path contains CJS-coupled assumptions in three areas:

1. Build-time compatibility rewriting in `scripts/build.mjs`.
2. Server launch model in `src/extensions/vscode/src/extension.ts` (`ServerOptions.run/debug.module` path).
3. Bundle internals and package/runtime expectations currently aligned around CJS output behavior.

This means ESM is feasible, but only as a coordinated migration.

## Scope

- Document spike evidence and blockers in backlog artifact form.
- Define phased migration tasks and acceptance criteria for implementation.
- Keep scope limited to extension/server build and launch behavior (no unrelated refactors).

## Tasks

- [x] Add an architecture note (or backlog-linked decision record) describing why current CJS compatibility rewriting breaks ESM runtime loading.
- [x] Audit and replace CJS-only `createRequire(__filename)` compatibility rewrites in the server dependency path with ESM-safe alternatives.
- [x] Prototype server-only ESM output while keeping extension entry behavior stable; verify startup in extension tests.
- [x] Decide and document target launch mechanism for ESM server under `vscode-languageclient/node` (module path, exec options, and debug path parity).
- [x] Add a focused regression test that proves server bundle startup works in the selected module format.
- [x] Keep bundled dependency validation (`scripts/validate-bundled-deps.mjs`) compatible with the chosen output format.
- [x] Run extension validation matrix: `build`, `test`, and extension-host smoke/startup checks.
- [x] Create changeset(s) for `vscode-templjs` and any impacted packages once migration work lands.

## Deliverables

- Backlog-tracked spike evidence with clear blocker classification.
- Approved phased migration plan for CJS-to-ESM server transition.
- Implementation-ready checklist with explicit validation gates.

## Phased Migration Plan

### Phase 1 (completed in this work item)

- Add opt-in server ESM output path in `scripts/build.mjs` while retaining CJS default output for release safety.
- Add extension-side module format selection (`templjs.serverModuleFormat`) so launch path can target either `dist/server.js` or `dist/server.mjs`.
- Add ESM startup regression coverage and keep dependency validation format-aware.

### Phase 2 (next hardening slice)

- Validate debug/run parity across extension-host startup scenarios when server module format is ESM.
- Expand startup smoke coverage to include extension-host test path assertions for ESM module launch behavior.

### Phase 3 (promotion gate)

- Promote ESM server bundle to default only after startup, test matrix, and packaging validation remain stable across CI and local release paths.
- Keep a rollback-safe checkpoint by retaining CJS build path until ESM default promotion is explicitly approved.

## Acceptance Criteria

- [x] The spike evidence is documented with reproducible observations and failure mode.
- [x] A phased migration plan exists with no ambiguous ownership of CJS-compat removal, server launch strategy, and validation.
- [x] Migration plan includes at least one rollback-safe checkpoint where CJS remains releasable.
- [x] Post-migration target criteria are explicit: server startup succeeds, tests pass, and packaging remains functional.
- [x] Frontmatter and work-item schema validation pass.

## Relationships

- `depends_on`: work-item-096-bug-ci-local-build-drift-for-vscode-extension

## Verification Evidence

- 2026-05-13: `rtk pnpm --dir src/extensions/vscode run test -- test/bundle-sanity.test.ts test/extension.test.ts test/server-main.test.ts` passed (130 tests).
- 2026-05-13: `rtk pnpm --dir src/extensions/vscode run build` passed (`tsc -b --force`, `scripts/build.mjs`, and `scripts/validate-bundled-deps.mjs`).
