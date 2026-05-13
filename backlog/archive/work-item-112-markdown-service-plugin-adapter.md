---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:112-markdown-service-plugin-adapter
title: '112: Markdown service-plugin adapter with runtime planning'
summary: Implement markdown adapter with runtime planning logic (e.g., if markdownlint isn't registered with .md, don't engage markdownlint plugin for diagnostics/language features). Move non-trivial plugin logic to separate files per contract.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
completed_date: '2026-05-08'
priority: high
estimated: 4
actual: 1
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/96
  evidence:
    - '[[record:wi-112-merge-evidence-2026-05-08]]'
---

## Goal

Ensure markdown language features delegate correctly to host markdown language servers while respecting adapter runtime planning constraints (manifest capabilities, workspace registration, language ID binding).

## Background

Current `createMarkdownHostDiagnosticsPlugin` and `createTempljsMarkdownDiagnosticsPlugin` contain language-specific behavior mixed with orchestration. Adapter must publish capabilities and respect runtime planning decisions from the service-plugin contract (WI-111).

## Scope

- Implement markdown adapter with published capabilities (file types, supported diagnostics, language features).
- Add runtime planning: if markdownlint isn't registered with `.md`, don't engage the markdownlint plugin.
- Separate non-trivial plugin logic (>20 lines) into dedicated files if needed.
- Validate contract alignment with other adapters.

## Tasks

- [x] Define markdown adapter capabilities (file patterns, supported language servers, feature list).
- [x] Implement runtime planning logic for markdown language server availability.
- [x] Audit `createMarkdownHostDiagnosticsPlugin` and `createTempljsMarkdownDiagnosticsPlugin` implementations.
- [x] Move non-trivial logic (>20 lines) into separate files; keep trivial logic in service-plugins.ts.
- [x] Add capability-aware gating for markdown features (e.g., only engage diagnostics if host LS registered).
- [x] Add tests for adapter initialization, capability publishing, and runtime gating.

## Deliverables

- Markdown adapter with published capabilities and runtime planning.
- Refactored plugin code (trivial colocated, non-trivial in separate files).
- Tests validating runtime gating and capability registration.

## Acceptance Criteria

- [x] Markdown adapter publishes correct capabilities.
- [x] Runtime planning prevents markdown plugins from engaging if language server not registered.
- [x] Plugin code organization follows contract guidance (colocated ≤20 lines, separate files >20 lines).
- [x] All tests pass; interface is contract-compliant.
- [x] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-111-service-plugin-contract-and-boundaries]]
