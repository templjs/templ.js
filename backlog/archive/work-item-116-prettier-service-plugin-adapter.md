---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:116-prettier-service-plugin-adapter
title: '116: Prettier service-plugin adapter with runtime planning'
summary: Implement Prettier adapter with runtime planning logic and capability publishing. Move non-trivial plugin logic to separate files per contract.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
completed_date: '2026-05-09'
priority: medium
estimated: 2
actual: 2
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/100
  evidence:
    - '[[record:wi-116-merge-evidence-2026-05-09]]'
---

## Goal

Ensure Prettier formatting features delegate correctly while respecting adapter runtime planning constraints (e.g., only engage Prettier if explicitly configured for supported file types).

## Background

Current `createPrettierHostServicePlugin` conditionally enables Prettier support based on configuration. Adapter must publish capabilities and respect runtime planning decisions from the service-plugin contract (WI-111).

## Scope

- Implement Prettier adapter with published capabilities (supported file types, formatting features).
- Add runtime planning: gating Prettier features based on configuration and language server registration.
- Separate non-trivial plugin logic (>20 lines) into dedicated files if needed.

## Tasks

- [x] Define Prettier adapter capabilities (supported formats: markdown, json, yaml, html).
- [x] Implement runtime planning logic for Prettier availability (configuration-based, host LS gating).
- [x] Audit `createPrettierHostServicePlugin` implementation.
- [x] Move non-trivial logic (>20 lines) into separate files; keep trivial logic in service-plugins.ts.
- [x] Add capability-aware gating for Prettier features.
- [x] Add tests for adapter initialization, capability publishing, and configuration gating.

## Deliverables

- Prettier adapter with published capabilities and runtime planning.
- Refactored plugin code following contract guidance.
- Tests validating capability registration and configuration-based gating.

## Acceptance Criteria

- [x] Prettier adapter publishes correct capabilities.
- [x] Runtime planning prevents Prettier from engaging unless explicitly configured.
- [x] Plugin code organization follows contract guidance.
- [x] All tests pass; interface is contract-compliant.
- [x] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-111-service-plugin-contract-and-boundaries]]
