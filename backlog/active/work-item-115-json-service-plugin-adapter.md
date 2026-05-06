---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:115-json-service-plugin-adapter
title: '115: JSON service-plugin adapter with runtime planning'
summary: Implement JSON adapter with runtime planning logic and capability publishing. Move non-trivial plugin logic to separate files per contract.
type: work-item
subtype: task
lifecycle: active
status: ready
priority: medium
estimated: 2
actual: 0
---

## Goal

Ensure JSON language features delegate correctly to host JSON language servers while respecting adapter runtime planning constraints.

## Background

Current `createJsonHostServicePlugin` delegates JSON support. Adapter must publish capabilities and respect runtime planning decisions from the service-plugin contract (WI-111).

## Scope

- Implement JSON adapter with published capabilities (file patterns, supported language servers).
- Add runtime planning: gating JSON features based on language server registration.
- Separate non-trivial plugin logic (>20 lines) into dedicated files if needed.

## Tasks

- [ ] Define JSON adapter capabilities (file patterns, supported servers, feature list).
- [ ] Implement runtime planning logic for JSON language server availability.
- [ ] Audit `createJsonHostServicePlugin` implementation.
- [ ] Move non-trivial logic (>20 lines) into separate files; keep trivial logic in service-plugins.ts.
- [ ] Add capability-aware gating for JSON features.
- [ ] Add tests for adapter initialization and capability publishing.

## Deliverables

- JSON adapter with published capabilities and runtime planning.
- Refactored plugin code following contract guidance.
- Tests validating capability registration.

## Acceptance Criteria

- [ ] JSON adapter publishes correct capabilities.
- [ ] Plugin code organization follows contract guidance.
- [ ] All tests pass; interface is contract-compliant.
- [ ] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-111-service-plugin-contract-and-boundaries]]
