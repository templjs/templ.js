---
'$schema': schemas/work-management/frontmatter/plan.json
id: plan:semantify-projection-full-cutover-implementation
title: Semantify Projection Full Cutover Implementation Plan
summary: End-to-end execution plan for complete projection/provenance semantic authority cutover and legacy artifact removal.
type: plan
subtype: tactical
lifecycle: active
status: ready
status_reason: prioritized
---

## Purpose

This plan drives full implementation of the superseding Semantify cutover lane (`WI-131` through `WI-139`) with deterministic graph/provenance semantics as the only semantic authority for completion, hover, definition, diagnostics, and highlighting.

Formatting remains permanently host delegated. The plan requires projection-aware semantic orchestration contracts for formatting, but does not move formatter policy/edit generation out of host language services.

Final evidence collation, closure confirmation, and archive movement remain with backlog automation workflows when available.

## Work Item Set

| Work item | Scope                                         | Role                                              |
| --------- | --------------------------------------------- | ------------------------------------------------- |
| `WI-131`  | Full cutover epic                             | Sequencing authority and closure gate             |
| `WI-132`  | Contract hardening/helper surface completion  | Foundation contract completion                    |
| `WI-133`  | Runtime determinism/provenance strict mode    | Deterministic runtime guarantees                  |
| `WI-134`  | Completion/hover/definition graph cutover     | Volar semantic read path cutover                  |
| `WI-135`  | Diagnostics/highlighting projection authority | Semantic authority cutover for diagnostics/tokens |
| `WI-136`  | Formatting orchestration with host delegation | Permanent formatting boundary contract            |
| `WI-137`  | Language-service/server capability wiring     | Transport integration finalization                |
| `WI-138`  | Legacy artifact purge/API cleanup             | Remove compatibility/migration surfaces           |
| `WI-139`  | Final verification/performance/evidence       | Final quality and closure readiness gate          |

## Final-State Definition

The implementation is complete only when all conditions are true:

1. Semantify public API is projection/profile contract first with no legacy compatibility helper exports.
2. Volar and language-service consume semantic outputs through graph/provenance plus helper extensions only.
3. Completion, hover, definition, diagnostics, and semantic highlighting execute through projection-backed contracts.
4. Formatting remains host delegated and workspace settings remain authoritative.
5. No migration shims, transition docs, or fallback tests remain.
6. Determinism and validation matrix gates pass.

## Execution Order

1. Complete `WI-132` (contract surface completion).
2. Complete `WI-133` (runtime determinism/provenance strict mode).
3. Run parallel lane: `WI-134`, `WI-135`, `WI-136`.
4. Complete `WI-137` once all parallel lane items are complete.
5. Complete `WI-138` for source/test/doc cleanup and legacy removal.
6. Complete `WI-139` for final verification, performance, and evidence collation.
7. Close `WI-131` only after `WI-132` through `WI-139` satisfy acceptance criteria.

## Parallelization Map

- Foundation lane (sequential): `WI-132` -> `WI-133`.
- Feature lane A: `WI-134`.
- Feature lane B: `WI-135`.
- Feature lane C: `WI-136`.
- Integration lane (sequential gate): `WI-137` after all feature lanes.
- Cleanup lane: `WI-138` after integration lane.
- Verification lane: `WI-139` after cleanup lane.

## Ownership Boundaries

- `@templjs/semantify`: adapter/profile contracts, projection runtime, deterministic graph/provenance emission.
- `@templjs/volar`: semantic read/query shaping from projected graph plus helper extension execution.
- `@templjs/language-service`: transport/plugin orchestration, position remapping, host service delegation.
- `@templjs/language-server`: LSP handlers and end-to-end capability wiring.
- `@templjs/core`: syntax/tokenization authority and parser semantics.

No transport package should own canonical semantic policy.

## Key File Targets

Semantify:

- `src/packages/semantify/src/model/public-types.ts`
- `src/packages/semantify/src/projector/index.ts`
- `src/packages/semantify/src/adapters/templjs.ts`
- `src/packages/semantify/src/index.ts`
- `src/packages/semantify/src/binder/framework.ts` (legacy removal target)

Volar:

- `src/packages/volar/src/intellisense-provider.ts`
- `src/packages/volar/src/context-graph-adapter.ts`
- `src/packages/volar/src/semantic-token-provider.ts`
- `src/packages/volar/src/diagnostic-provider.ts`

Language-service and server:

- `src/packages/language-service/src/service-plugins.ts`
- `src/packages/language-service/src/runtime-manifest.ts`
- `src/packages/language-server/src/server.ts`

Documentation:

- `src/packages/semantify/README.md`
- `docs/templjs-volar-target-architecture.md`
- `docs/adr/009-adapter-runtime-manifest-and-plugin-boundaries.md` (if clarifying amendments are required)

## Validation Gates

Per-phase package checks:

```bash
pnpm --filter @templjs/semantify test
pnpm --filter @templjs/semantify build
pnpm --filter @templjs/volar test
pnpm --filter @templjs/volar build
pnpm --filter @templjs/language-service test
pnpm --filter @templjs/language-server test
```

Final repo-level checks:

```bash
pnpm run lint:frontmatter
pnpm run type-check
pnpm run test
pnpm run build
```

Determinism/performance checks:

- Repeat projection on fixed fixtures and compare serialized graph/provenance snapshots for byte-stable equality.
- Measure completion/hover/diagnostics/semantic-token response performance against baseline fixtures.

## Agent Execution Protocol

When delegating to subagents:

1. Assign one work item owner per lane to avoid simultaneous edits to shared contract files.
2. Require each lane owner to run narrow package validation before merge.
3. Rebase/sync at phase boundaries only.
4. Block integration lane until all feature lanes provide passing tests.
5. Block cleanup lane until integration lane is green.
6. Block final closure until determinism and repo-level validations pass.

## Completion Checklist

- [ ] All `WI-132` through `WI-139` acceptance criteria complete.
- [ ] `WI-131` child tasks complete.
- [ ] Legacy Semantify compatibility APIs and references removed from source/tests/docs.
- [ ] Projection-backed semantic authority verified across all targeted features.
- [ ] Host formatting delegation policy preserved and tested.
- [ ] Final validation matrix and performance/determinism gates passed.
