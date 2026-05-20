---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:130-language-service-helper-extension-cutover
title: '130: Language Service Helper Extension Cutover'
summary: Move editor affordances to profile helper extension boundaries and cut language-service/Volar consumers over to projected Semantify output.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation
priority: high
estimated: 6
actual: 0
links:
  evidence:
    - '[[record-20260520-130-language-service-helper-extension-cutover]]'
---

## Goal

Cut language-service and Volar consumers over to Semantify projection output and profile helper extension boundaries so hover, definition, completion, and diagnostics shaping stay outside Semantify core.

## Background

Current Semantify APIs expose editor-shaped concepts such as candidate planning, hover payloads, and definition targets. Volar still contains reusable semantic construction and fallback behavior in `context-graph-adapter.ts`, `context-graph-snapshot.ts`, and `intellisense-provider.ts`.

## Tasks

- [x] Define language-service-facing helper extension adapters for candidates, definitions, hover rendering, and diagnostic planning.
- [x] Route language-service/Volar semantic reads through projected graph output and profile helper extensions.
- [x] Remove or quarantine Semantify core APIs that encode editor-specific intent names.
- [ ] Retire duplicated Volar semantic derivation once projected output parity is proven.
- [x] Keep LSP item shaping, range mapping, and host-service delegation in language-service/Volar packages.
- [x] Add end-to-end tests for completion, hover, definition, diagnostics, and source-range provenance.

## Progress Notes

- 2026-05-20: Added `createSemantifyProjectionSnapshot` in `@templjs/volar` as a thin language-service-facing bridge over projected Semantify graph output.
- 2026-05-20: Legacy editor-shaped Semantify APIs remain intentionally available until a full parity cutover removes or quarantines them.
- 2026-05-20: Routed Volar schema-path and enum reads through projected Semantify output, with compatibility nodes retaining Semantify provenance.
- 2026-05-20: Existing completion, hover, definition, diagnostics, and source-range suites passed under Node 24; full duplicate Volar derivation retirement remains pending behind parity follow-up.

## Deliverables

- Language-service/Volar integration over Semantify projected output.
- Profile helper extension adapters for editor affordances.
- Compatibility and provenance-backed range tests.

## Acceptance Criteria

- [ ] Hover, definition, completion, and diagnostics use projected semantic output or helper extensions rather than Semantify core policy.
- [x] Semantify core remains projection-focused and editor-domain agnostic.
- [x] Existing TemplJS language-service behavior remains covered by integration tests.
- [x] Volar code keeps LSP shaping and range mapping responsibilities but no longer owns canonical reusable schema projection.

## Relationships

- `depends_on`: [[work-item-129-templjs-template-and-schema-profile-integration]]
- `depends_on`: [[work-item-075-split-volar-context-graph-adapter-by-responsibility]]
- `depends_on`: [[work-item-076-split-volar-intellisense-and-diagnostic-providers-by-responsibility]]
