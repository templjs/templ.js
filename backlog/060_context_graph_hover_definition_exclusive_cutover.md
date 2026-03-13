---
id: wi-060
type: work-item
subtype: task
lifecycle: active
title: '060: Enforce exclusive context-graph hover/definition resolution'
status: in-progress
priority: high
estimated: 8
actual: 0
assignee: ''
links:
  implements:
    - '[[056_context_graph_platform_epic]]'
  depends_on:
    - '[[058_context_graph_volar_adapter_and_semantic_reads]]'
---

## Goal

Make `@templjs/context-graph` the sole source of hover and definition answers for templ authoring so the VS Code extension server no longer computes schema-path targets, schema-token jumps, or schema range resolution.

Normalize semantic ownership around location-context queries so frontmatter/content and primary/secondary are treated as input aliases derived from syntax (`$schema` / `$content_schema`) inside core, not as Volar semantics.

## Scope

- Remove extension-server hover/definition resolver ownership
- Route Volar hover/definition reads through location-qualified context-graph adapter queries only
- Return final `uri`/`range` results from Volar for semantic paths and schema references without server callbacks
- Eliminate standalone read-side resolver layers that duplicate server logic; keep resolution encapsulated in the context-graph adapter boundary
- Treat frontmatter/content and primary/secondary as aliasing of context blocks selected from document location only, implemented in core
- Include `diagnostics` in the semantic operation contract and payload-shape planning to avoid operation-specific drift
- Preserve alias-scoped definitions and frontmatter schema-reference authoring flows
- Add regression tests for nested `type` collisions and schema-token parity

## Tasks

- [x] Add context-graph-backed definition target contract in Volar adapter
- [x] Define operation contract parity for `completion`, `hover`, `definition`, and `diagnostics` at the context-graph boundary
- [x] Route hover path details exclusively through context-graph reads
- [x] Route definition targets exclusively through context-graph reads
- [x] Remove extension-server schema range and schema-token definition logic
- [x] Remove standalone Volar definition-resolver module and fold behavior into context-graph adapter boundary
- [x] Move `$schema` / `$content_schema` alias-to-context-block translation into core
- [ ] Reduce Volar role to operation + document + position forwarding and LSP payload mapping only
- [x] Add regression coverage for schema refs, nested item properties, and alias-scoped definitions
- [x] Update trace logging to reflect graph-owned hover/definition resolution

## Acceptance Criteria

- [x] [src/extensions/vscode/src/server.ts](src/extensions/vscode/src/server.ts) no longer computes hover/definition targets beyond request plumbing
- [x] Volar returns final location-qualified definition results without server range callbacks
- [x] No standalone `definition-resolver` module remains; definition resolution lives behind the context-graph adapter boundary
- [ ] Volar does not model frontmatter/content or primary/secondary as semantic branches
- [x] Alias handling (`$schema` / `$content_schema` → context block) is owned by core
- [x] Core semantic operation and payload contracts are aligned across `completion`, `hover`, `definition`, and `diagnostics`
- [x] Hover for schema-backed paths is sourced from context-graph responses, not direct schema fallbacks
- [x] Go-to-definition for `relationships[0].type` resolves to the nested item property definition, not a substring collision
- [x] Frontmatter schema references (`$schema`, `$content_schema`, path-like schema fields) resolve through the Volar/context-graph boundary
- [x] Targeted tests and builds pass

## Notes

- This work tightens the architecture promised by [[056_context_graph_platform_epic]] and completes the fallback-removal cutover left open by [[058_context_graph_volar_adapter_and_semantic_reads]].
