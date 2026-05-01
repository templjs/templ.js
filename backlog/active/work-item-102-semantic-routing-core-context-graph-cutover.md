---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:102-semantic-routing-core-context-graph-cutover
title: '102: Route semantics through core and context graph end-to-end'
summary: Remove Volar-local semantic scanners and ensure completion/hover/definition/diagnostics share one core/context-graph semantic snapshot
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
priority: high
estimated: 12
actual: 3
---

## Goal

Deliver Stage 5 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by making `@templjs/core` and `@templjs/context-graph` the semantic authority for all authoring operations.

## Scope

- Publish parse/scope/alias/schema/zone facts to context graph from root virtual code updates.
- Rebuild completion/hover/definition/diagnostics as context-graph consumers.
- Remove regex-driven semantic interpretation from Volar/VS Code layers.

## Tasks

- [x] Add semantic snapshot publication path from virtual code updates.
- [x] Replace provider-local path/filter/alias scanners with shared semantic reads.
- [x] Align completion/hover/definition/diagnostics contracts against one snapshot id.
- [x] Keep provider-local logic limited to LSP payload shaping/filtering/presentation.
- [x] Add parity suites for default delimiters and at least one custom delimiter setup.

## Acceptance Criteria

- [x] Completion/hover/definition/diagnostics use the same semantic snapshot authority.
- [x] No new regex-based semantic parsing is introduced in Volar or VS Code layers.
- [x] Existing behavior-critical authoring suites remain green after fallback removal.

## Relationships

- `depends_on`: [[work-item-100-root-and-embedded-virtual-code-model-cutover]]
- `depends_on`: [[work-item-101-host-language-service-composition-cutover]]
- `depends_on`: [[work-item-060-context-graph-hover-definition-exclusive-cutover]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
