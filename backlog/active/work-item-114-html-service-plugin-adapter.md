---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:114-html-service-plugin-adapter
title: '114: HTML service-plugin adapter with runtime planning'
summary: Implement HTML adapter with runtime planning logic and capability publishing. Move non-trivial plugin logic to separate files per contract.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation
priority: medium
estimated: 2
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/98
---

## Goal

Ensure HTML language features delegate correctly to host HTML language servers while respecting adapter runtime planning constraints.

## Background

Current `createHtmlHostServicePlugin` delegates HTML support. Adapter must publish capabilities and respect runtime planning decisions from the service-plugin contract (WI-111).

## Scope

- Implement HTML adapter with published capabilities (file patterns, supported language servers).
- Add runtime planning: gating HTML features based on language server registration.
- Separate non-trivial plugin logic (>20 lines) into dedicated files if needed.

## Tasks

- [ ] Define HTML adapter capabilities (file patterns, supported servers, feature list).
- [ ] Implement runtime planning logic for HTML language server availability.
- [ ] Audit `createHtmlHostServicePlugin` implementation.
- [ ] Move non-trivial logic (>20 lines) into separate files; keep trivial logic in service-plugins.ts.
- [ ] Add capability-aware gating for HTML features.
- [ ] Add tests for adapter initialization and capability publishing.

## Deliverables

- HTML adapter with published capabilities and runtime planning.
- Refactored plugin code following contract guidance.
- Tests validating capability registration.

## Acceptance Criteria

- [ ] HTML adapter publishes correct capabilities.
- [ ] Plugin code organization follows contract guidance.
- [ ] All tests pass; interface is contract-compliant.
- [ ] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-111-service-plugin-contract-and-boundaries]]
