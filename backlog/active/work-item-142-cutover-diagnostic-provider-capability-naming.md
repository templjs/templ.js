---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:142-cutover-diagnostic-provider-capability-naming
title: '142: Cut Over Diagnostic Provider Capability Naming'
summary: Replace diagnostic planner terminology with diagnostic provider terminology everywhere
assignee: copilot
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: awaiting-review
priority: high
estimated: 6
actual: 0
links:
  evidence:
    - '[[record-20260523-044941-142-cutover-diagnostic-provider-capability-naming]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/180
---

## Goal

Replace planner terminology with provider terminology for diagnostic helper capabilities and identifiers.

## Execution Dependencies

- Depends on `work-item:141-unify-diagnostic-record-contract-across-layers`.

## Scope

- Rename capability kind `diagnostic-planner` to `diagnostic-provider`.
- Rename helper ids and local constants to provider wording.
- Remove planner wording across public and private symbols.

## File-by-File Rename Checklist

- [x] [src/packages/semantify/src/model/public-types.ts](src/packages/semantify/src/model/public-types.ts)
  - `ProfileHelperExtensionKind` value `diagnostic-planner` -> `diagnostic-provider`
- [x] [src/packages/semantify/src/adapters/templjs.ts](src/packages/semantify/src/adapters/templjs.ts)
  - helper kind `diagnostic-planner` -> `diagnostic-provider`
  - helper id `templjs.authoring.diagnostics` -> `templjs.authoring.diagnostic-provider`
- [x] [src/packages/semantify/src/projector/index.ts](src/packages/semantify/src/projector/index.ts)
  - `VALID_HELPER_KINDS` member `diagnostic-planner` -> `diagnostic-provider`
- [x] [src/packages/volar/src/diagnostic-provider.ts](src/packages/volar/src/diagnostic-provider.ts)
  - `DIAGNOSTIC_PLANNER_SOURCE` -> `DIAGNOSTIC_PROVIDER_SOURCE`
  - helper lookup kind `diagnostic-planner` -> `diagnostic-provider`

## Tasks

- [x] Rename helper extension kind value.
- [x] Rename profile helper id.
- [x] Rename provider lookup constants and references.
- [x] Update tests asserting helper kind and source id values.
- [x] Remove all planner wording from touched files.

## Deliverables

- Diagnostic provider naming standardized across semantify and volar.
- No planner terminology in capability names.

## Acceptance Criteria

- [x] No `diagnostic-planner` tokens remain in code or tests in touched paths.
- [x] Profile helper metadata resolves with `diagnostic-provider` kind only.
- [x] Affected tests pass.

## Testing Strategy

- Run semantify and volar tests covering helper extension metadata and source labeling.
- Run workspace grep checks for retired planner token.
