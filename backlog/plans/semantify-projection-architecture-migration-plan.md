---
$schema: schemas/work-management/frontmatter/plan.json
id: plan:semantify-projection-architecture-migration
title: Semantify Projection Architecture Migration Plan
summary: Migration plan for projection-first Semantify, provenance-aware Context Graph primitives, and TemplJS adapter/profile integration.
type: plan
subtype: tactical
lifecycle: inactive
status: closed
status_reason: completed
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/156
    - https://github.com/templjs/templ.js/pull/157
    - https://github.com/templjs/templ.js/pull/158
---

## Purpose

This plan tracks the migration from the current editor-shaped Semantify and Volar context-graph helpers to a projection-first semantic architecture:

```text
source context -> adapter output -> profile projection -> graph primitives -> client/domain helpers
```

The immediate deliverable is backlog tracking for `WI-125` through `WI-130`. The implementation deliverable is reusable Semantify projection and Context Graph provenance support integrated into TemplJS authoring flows without preserving editor-specific behavior in Semantify core.

## Target Boundaries

| Layer                    | Owns                                                                                      | Does Not Own                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Adapter                  | Source-context parsing/extraction, spans, adapter metadata                                | Canonical semantic policy                                     |
| Profile                  | Semantic definition, projection rules, helper extension contracts                         | Adapter internals, editor or CI policy                        |
| Semantify                | Adapter validation, projection execution, deterministic graph output, provenance emission | Hover text, definition policy, CI severity, domain resolution |
| Context Graph            | Node/edge/provenance primitives, snapshots, deterministic in-process query                | Semantic interpretation, graph database behavior              |
| Language Service / Volar | LSP shaping, range mapping, host-service delegation, profile helper execution             | Canonical reusable semantic projection                        |
| Linkity / Domain Clients | Resolution, backlinks, policy, diagnostics outcomes                                       | Adapter internals, Semantify projection internals             |

## Work Items

| Work item | Scope                                            | Role                                |
| --------- | ------------------------------------------------ | ----------------------------------- |
| `WI-125`  | Semantify projection architecture migration epic | Overall migration umbrella          |
| `WI-126`  | Context Graph primitive and provenance contracts | Graph/provenance substrate          |
| `WI-127`  | Semantify adapter and profile contract surface   | Public projection contracts         |
| `WI-128`  | Semantify projection runtime and DSL foundation  | Runtime implementation and DSL path |
| `WI-129`  | TemplJS template and schema profile integration  | TemplJS adapters/profile rollout    |
| `WI-130`  | Language service helper extension cutover        | Editor integration cleanup          |

## Execution Order

1. Complete `WI-126` and `WI-127` together as the contract foundation.
2. Complete `WI-128` after both contract slices are stable.
3. Complete `WI-129` by migrating reusable template/schema construction through adapters and profile projection.
4. Complete `WI-130` by cutting language-service and Volar paths over to projected output plus helper extensions.
5. Update package READMEs and architecture docs once implementation contracts settle.

## Parallelization Map

- Contract lane: `WI-126`, `WI-127`.
- Runtime lane: `WI-128` after the contract lane.
- TemplJS integration lane: `WI-129` after runtime projection exists.
- Editor cutover lane: `WI-130` after TemplJS projected output has parity evidence.

Avoid parallel edits to `@templjs/semantify` public model types, `@templjs/context-graph` public types, and Volar semantic read paths unless ownership boundaries are explicit in the branch plan.

## Compatibility Strategy

Maintain current `resolveContext`, `resolveReferences`, and `planCandidates` behavior through compatibility adapters while the projection path is introduced. Remove or quarantine editor-shaped Semantify APIs only after language-service/Volar consumers have profile helper replacements and parity tests.

Keep Context Graph domain-agnostic. If implementation needs richer graph traversal, evaluate an adapter to an existing graph engine before adding database-like behavior to `@templjs/context-graph`.

## Validation Gates

Run narrow package validation at each phase:

```bash
pnpm --filter @templjs/context-graph test
pnpm --filter @templjs/context-graph build
pnpm --filter @templjs/semantify test
pnpm --filter @templjs/semantify build
pnpm --filter @templjs/volar test
pnpm --filter @templjs/language-service test
```

Run repo-level validation before final cutover:

```bash
pnpm run lint:frontmatter
pnpm run type-check
pnpm run test
pnpm run build
```

## Evidence Expectations

Each implementation slice should record:

- public contract changes and compatibility notes,
- deterministic projection test results,
- provenance serialization/range evidence,
- before/after behavior parity for existing authoring flows,
- files or APIs intentionally left as compatibility shims.

Final evidence collation, closure confirmation, and archive movement remain with backlog automation if enabled.
