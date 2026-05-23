---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:146-remove-legacy-artifacts-and-finalize-diagnostics-architecture
title: '146: Remove Legacy Artifacts and Finalize Diagnostics Architecture'
summary: Remove all migration and legacy naming artifacts and document the final diagnostics architecture
assignee: copilot
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 8
actual: 0
links:
  evidence:
    - '[[record-20260523-044941-146-remove-legacy-artifacts-and-finalize-diagnostics-architecture]]'
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

- [ ] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - remove legacy field names and transitional comments tied to old naming
- [ ] [src/packages/semantify/src/model/public-types.ts](src/packages/semantify/src/model/public-types.ts)
  - remove superseded diagnostic and helper naming artifacts
- [ ] [src/packages/semantify/src/projector/index.ts](src/packages/semantify/src/projector/index.ts)
  - remove transitional normalization helpers introduced only for migration
- [ ] [src/packages/volar/src/diagnostic-types.ts](src/packages/volar/src/diagnostic-types.ts)
  - remove local legacy aliases and outdated type comments
- [ ] [docs/api-reference.md](docs/api-reference.md)
  - update diagnostics and semantic contracts to final canonical names
- [ ] [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md)
  - update architecture flow terminology to final canonical stack
- [ ] [docs/adr](docs/adr)
  - add or update ADR for final diagnostics-layer architecture and naming canon

## Tasks

- [ ] Remove all legacy and migration artifacts from source contracts.
- [ ] Update docs and ADRs to canonical final terminology.
- [ ] Verify package exports include only final symbols.
- [ ] Run full impacted tests and documentation checks.
- [ ] Validate no retired names remain in repository search.

## Deliverables

- Finalized diagnostics architecture with zero transition residue.
- Updated docs and ADRs reflecting final state.

## Acceptance Criteria

- [ ] No compatibility aliases or migration-only symbols remain.
- [ ] Documentation describes only final canonical syntax and semantic stack.
- [ ] Repository-wide search shows no retired symbol names.
- [ ] Impacted tests and checks pass.

## Testing Strategy

- Run package tests for core, semantify, volar, language-core, and language-service where touched.
- Run doc and frontmatter validation checks for updated artifacts.
- Perform final workspace grep for retired naming tokens.
