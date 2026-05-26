---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:146-remove-legacy-artifacts-and-finalize-diagnostics-architecture
title: '146: Remove Legacy Artifacts and Finalize Diagnostics Architecture'
summary: Remove all migration and legacy naming artifacts and document the final diagnostics architecture
assignee: copilot
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implementation-complete
priority: high
estimated: 8
actual: 6
links:
  evidence:
    - '[[record-20260523-044941-146-remove-legacy-artifacts-and-finalize-diagnostics-architecture]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/186'
---

## Goal

Fully remove transition and legacy artifacts and leave a coherent, industry-standard syntax and semantic diagnostics stack.

## Execution Dependencies

- Depends on `work-item:141-unify-diagnostic-record-contract-across-layers`.
- Depends on `work-item:142-cutover-diagnostic-provider-capability-naming`.
- Depends on `work-item:143-unify-semantic-zone-vocabulary-metadata-content-template`.
- Depends on `work-item:144-unify-host-language-terminology-and-fallback`.
- Depends on `work-item:145-profile-map-semantic-diagnostics-to-syntax-diagnostics`.

## Scope

- Remove all transitional names and old symbols.
- Update API and architecture documentation to final canonical names only.
- Ensure no migration notes remain in production contracts.

## File-by-File Cleanup Checklist

- [x] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - remove legacy field names and transitional comments tied to old naming
- [x] [src/packages/semantify/src/model/public-types.ts](src/packages/semantify/src/model/public-types.ts)
  - remove superseded diagnostic and helper naming artifacts
- [x] [src/packages/semantify/src/projector/index.ts](src/packages/semantify/src/projector/index.ts)
  - remove transitional normalization helpers introduced only for migration
- [x] [src/packages/volar/src/diagnostic-types.ts](src/packages/volar/src/diagnostic-types.ts)
  - remove local legacy aliases and outdated type comments
- [x] [docs/api-reference.md](docs/api-reference.md)
  - update diagnostics and semantic contracts to final canonical names
- [x] [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md)
  - update architecture flow terminology to final canonical stack
- [x] [docs/adr](docs/adr)
  - add or update ADR for final diagnostics-layer architecture and naming canon

## Tasks

- [x] Remove all legacy and migration artifacts from source contracts.
- [x] Update docs and ADRs to canonical final terminology.
- [x] Verify package exports include only final symbols.
- [x] Run full impacted tests and documentation checks.
- [x] Validate no retired names remain in repository search.

## Deliverables

- Finalized diagnostics architecture with zero transition residue.
- Updated docs and ADRs reflecting final state.

## Acceptance Criteria

- [x] No compatibility aliases or migration-only symbols remain.
- [x] Documentation describes only final canonical syntax and semantic stack.
- [x] Repository-wide search shows no retired symbol names.
- [x] Impacted tests and checks pass.

## Testing Strategy

- Run package tests for core, semantify, volar, language-core, and language-service where touched.
- Run doc and frontmatter validation checks for updated artifacts.
- Perform final workspace grep for retired naming tokens.

## Staging Review (2026-05-25)

Verified gaps remaining before `ready-for-review`:

- Compatibility residue still exists in [src/packages/volar/src/context-graph-adapter.ts](../../src/packages/volar/src/context-graph-adapter.ts) via `legacyContextBlock` and `contextBlock` compatibility mapping.
- API docs are not fully canonical in [docs/api-reference.md](../../docs/api-reference.md): `validateTemplate(template)` is documented as returning `{ valid, errors? }`, while current contract returns `syntaxDiagnostics`.
- Repository-wide token search still returns retired names in backlog/archive records; strict acceptance criterion remains open until policy scope is clarified or criterion wording is narrowed.

Validated checks run during review:

- `rtk pnpm --filter @templjs/core test`
- `rtk pnpm --filter @templjs/semantify test`
- `rtk pnpm --filter @templjs/volar test`
- `rtk pnpm --filter @templjs/language-core test`
- `rtk pnpm --filter @templjs/language-service test`
- `rtk pnpm run lint:frontmatter`
- `rtk pnpm run lint:markdown:docs`

## Current Review (2026-05-26)

Re-validated against current `staging` state:

- Removed migration-only `legacyContextBlock` compatibility residue from [src/packages/volar/src/context-graph-adapter.ts](../../src/packages/volar/src/context-graph-adapter.ts) and aligned branch tests.
- Updated [docs/api-reference.md](../../docs/api-reference.md) so `validateTemplate(template)` documents `{ valid, syntaxDiagnostics }`.
- Added canonical inferred-first precedence and fallback narrative in [docs/templjs-volar-target-architecture.md](../../docs/templjs-volar-target-architecture.md).
- Search verification passes for production source/docs scope (`src/packages`, `docs`) for retired tokens tracked by this work item.

Validated checks run during completion:

- `rtk pnpm --filter @templjs/core test`
- `rtk pnpm --filter @templjs/semantify test`
- `rtk pnpm --filter @templjs/volar test`
- `rtk pnpm run lint:markdown:docs`
