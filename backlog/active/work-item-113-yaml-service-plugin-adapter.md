---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:113-yaml-service-plugin-adapter
title: '113: YAML service-plugin adapter with runtime planning'
summary: Implement YAML adapter with runtime planning logic and capability publishing. Move non-trivial plugin logic to separate files per contract.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation
priority: medium
estimated: 2
actual: 0
---

## Goal

Ensure YAML language features delegate correctly to host YAML language servers while respecting adapter runtime planning constraints.

## Background

Current `createYamlDiagnosticsPlugin` performs YAML validation. Adapter must publish capabilities and respect runtime planning decisions from the service-plugin contract (WI-111).

## Scope

- Implement YAML adapter with published capabilities (file patterns, supported language servers).
- Add runtime planning: gating YAML diagnostics based on language server registration.
- Separate non-trivial plugin logic (>20 lines) into dedicated files if needed.

## Tasks

- [ ] Define YAML adapter capabilities (file patterns, supported servers, feature list).
- [ ] Implement runtime planning logic for YAML language server availability.
- [ ] Audit `createYamlDiagnosticsPlugin` implementation for non-trivial logic.
- [ ] Move non-trivial logic (>20 lines) into separate files; keep trivial logic in service-plugins.ts.
- [ ] Add capability-aware gating for YAML features.
- [ ] Add tests for adapter initialization and capability publishing.

## Deliverables

- YAML adapter with published capabilities and runtime planning.
- Refactored plugin code following contract guidance.
- Tests validating capability registration.

## Acceptance Criteria

- [ ] YAML adapter publishes correct capabilities.
- [ ] Plugin code organization follows contract guidance.
- [ ] All tests pass; interface is contract-compliant.
- [ ] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-111-service-plugin-contract-and-boundaries]]
