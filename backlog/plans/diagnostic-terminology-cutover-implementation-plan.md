---
'$schema': schemas/work-management/frontmatter/plan.json
id: plan:diagnostic-terminology-cutover-implementation
title: Diagnostic Terminology Cutover Implementation Plan
summary: End-to-end plan to unify diagnostic, zone, and host-language terminology across core, semantify, volar, language-service, language-server, tests, and docs.
type: plan
subtype: tactical
lifecycle: active
status: ready
status_reason: prioritized
---

## Purpose

This plan executes the naming and contract cutover that prevents drift between syntax/semantic diagnostics and semantic context vocabulary.

It defines a deterministic sequence with parallel lanes and explicit integration gates so implementation can proceed with minimal churn and no compatibility ambiguity.

## Work Item Set

| Work item | Scope                                                 | Role                                   |
| --------- | ----------------------------------------------------- | -------------------------------------- |
| `WI-141`  | Diagnostic record contract unification                | Foundation contract baseline           |
| `WI-142`  | Diagnostic provider capability naming cutover         | Runtime/provider naming alignment      |
| `WI-143`  | Semantic zone vocabulary normalization                | Semantic context vocabulary authority  |
| `WI-144`  | Host language terminology/fallback normalization      | Host language consistency              |
| `WI-145`  | Syntax/semantic diagnostic profile mapping            | Deterministic dual-surface diagnostics |
| `WI-146`  | Legacy artifact removal and architecture finalization | Cleanup, hardening, and closure        |

## Final-State Definition

Implementation is complete only when all conditions are true:

1. A single canonical diagnostic record contract is used across core, semantify, volar, language-service, and language-server.
2. Capability/provider naming is consistent and no legacy naming aliases remain in source or tests.
3. Semantic zone terminology is normalized to metadata/content/template and aligned between contracts, docs, and tests.
4. Host language terminology and fallback semantics are normalized and verified in provider behavior.
5. Semantic diagnostics are mapped from syntax diagnostics via profile rules without ad-hoc suppression logic.
6. Legacy artifacts, migration notes, and deprecated names are removed from source/tests/docs.

## Execution Order

1. Complete `WI-141` as the contract baseline.
2. Run parallel lane A: `WI-142`.
3. Run parallel lane B: `WI-143` and `WI-144` (with `WI-144` depending on `WI-143`).
4. Complete `WI-145` after `WI-141`, `WI-142`, and `WI-143` are complete.
5. Complete `WI-146` after all prior work items complete.

## Parallelization Map

- Foundation lane (sequential): `WI-141`.
- Feature lane A: `WI-142`.
- Feature lane B (sequential inside lane): `WI-143` -> `WI-144`.
- Integration lane: `WI-145` after foundation + feature lanes complete.
- Cleanup lane: `WI-146` after integration lane.

## Package Ownership Boundaries

- `@templjs/core`: syntax diagnostics shape and semantic context baseline naming.
- `@templjs/semantify`: projection/public-type naming contracts and mapping rules.
- `@templjs/volar`: provider/runtime integration and diagnostics consumption.
- `@templjs/language-service`: plugin transport and capability wiring alignment.
- `@templjs/language-server`: protocol exposure and naming consistency at LSP boundary.

## Key File Targets

Core:

- `src/packages/core/src/semantic/semantic-context.ts`
- `src/packages/core/src/semantic/types.ts`

Semantify:

- `src/packages/semantify/src/model/public-types.ts`
- `src/packages/semantify/src/projector/index.ts`
- `src/packages/semantify/src/index.ts`

Volar and language packages:

- `src/packages/volar/src/diagnostic-template-analysis.ts`
- `src/packages/volar/src/diagnostic-provider.ts`
- `src/packages/volar/src/intellisense-provider.ts`
- `src/packages/language-service/src/service-plugins.ts`
- `src/packages/language-server/src/server.ts`

Documentation and tests:

- `docs/templjs-volar-target-architecture.md`
- `docs/adr/009-adapter-runtime-manifest-and-plugin-boundaries.md` (if terminology amendments are required)
- Colocated tests impacted by terminology and contract changes under affected packages.

## Validation Gates

Per-phase package checks:

```bash
rtk pnpm --filter @templjs/core test
rtk pnpm --filter @templjs/semantify test
rtk pnpm --filter @templjs/volar test
rtk pnpm --filter @templjs/language-service test
rtk pnpm --filter @templjs/language-server test
```

Final repository checks:

```bash
rtk pnpm run lint:frontmatter
rtk pnpm run type-check
rtk pnpm run test
rtk pnpm run build
```

## Agent Execution Protocol

1. Assign one owner per lane to minimize concurrent edits to shared contracts.
2. Require each lane to run narrow package tests before integration.
3. Block `WI-145` until all prerequisites report green tests.
4. Block `WI-146` until integration lane is green and terminology drift checks pass.
5. Keep closure/archive workflow delegated to backlog automation policy.

## Completion Checklist

- [ ] `WI-141` through `WI-146` acceptance criteria complete.
- [ ] No legacy diagnostic naming remains in source/tests/docs.
- [ ] Semantic zone and host language terminology are canonicalized in contracts and behavior.
- [ ] Syntax-to-semantic diagnostic mapping is deterministic and validated.
- [ ] Frontmatter/type-check/test/build validations are green.
