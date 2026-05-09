---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:114-html-service-plugin-adapter
title: '114: HTML service-plugin adapter with runtime planning'
summary: Implement HTML adapter with runtime planning logic and capability publishing. Move non-trivial plugin logic to separate files per contract.
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implemented
priority: medium
estimated: 2
actual: 2
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

- [x] Define HTML adapter capabilities (file patterns, supported servers, feature list).
- [x] Implement runtime planning logic for HTML language server availability.
- [x] Audit `createHtmlHostServicePlugin` implementation.
- [x] Move non-trivial logic (>20 lines) into separate files; keep trivial logic in service-plugins.ts.
- [x] Add capability-aware gating for HTML features.
- [x] Add tests for adapter initialization and capability publishing.

## Deliverables

- HTML adapter with published capabilities and runtime planning.
- Refactored plugin code following contract guidance.
- Tests validating capability registration.

## Acceptance Criteria

- [x] HTML adapter publishes correct capabilities.
- [x] Plugin code organization follows contract guidance.
- [x] All tests pass; interface is contract-compliant.
- [x] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-111-service-plugin-contract-and-boundaries]]
