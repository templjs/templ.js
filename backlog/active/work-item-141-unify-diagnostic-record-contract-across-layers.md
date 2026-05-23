---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:141-unify-diagnostic-record-contract-across-layers
title: '141: Unify Diagnostic Record Contract Across Layers'
summary: Establish one canonical diagnostic record contract across syntax, semantic, and editor surfaces
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 10
actual: 0
assignee: copilot
---

## Goal

Define and enforce one canonical diagnostic contract and naming set across core, semantify, and volar, replacing layer-specific diagnostic type names.

## Scope

- Introduce canonical names and remove superseded symbols in one cutover:
  - `SyntaxDiagnosticRecord`
  - `SemanticDiagnosticRecord`
  - `DiagnosticSeverity`
  - `ParseDiagnosticPhase`
- Apply canonical names to public and private symbols in touched packages.
- Remove legacy aliases and transition shims.

## File-by-File Rename Checklist

- [ ] [src/packages/semantify/src/model/public-types.ts](src/packages/semantify/src/model/public-types.ts)
  - `ProjectionDiagnosticSeverity` -> `DiagnosticSeverity`
  - `AdapterDiagnostic` -> `SyntaxDiagnosticRecord`
  - `ProjectionDiagnostic` -> `SemanticDiagnosticRecord`
- [ ] [src/packages/semantify/src/index.ts](src/packages/semantify/src/index.ts)
  - export `ProjectionDiagnosticSeverity` -> export `DiagnosticSeverity`
  - export `AdapterDiagnostic` -> export `SyntaxDiagnosticRecord`
  - export `ProjectionDiagnostic` -> export `SemanticDiagnosticRecord`
- [ ] [src/packages/volar/src/diagnostic-types.ts](src/packages/volar/src/diagnostic-types.ts)
  - `DiagnosticItem` -> `SemanticDiagnosticRecord`
  - `DiagnosticOptions.baseDiagnostics` -> `DiagnosticOptions.baseSyntaxDiagnostics`
- [ ] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - `SemanticDiagnosticResult` -> `SemanticDiagnosticRecord`
  - severity numeric type -> canonical `DiagnosticSeverity`

## Tasks

- [ ] Replace diagnostic type symbols in semantify model and exports.
- [ ] Replace diagnostic type symbols in volar diagnostics contracts.
- [ ] Replace core semantic diagnostic naming and severity typing.
- [ ] Update direct imports and internal references in touched packages.
- [ ] Remove superseded symbols entirely (no compatibility aliases).
- [ ] Add or update tests that enforce canonical type names at package boundaries.

## Deliverables

- Canonical diagnostic contract applied across packages.
- Removal of obsolete diagnostic symbols.
- Passing typecheck and package tests in touched areas.

## Acceptance Criteria

- [ ] No remaining references to `ProjectionDiagnosticSeverity`, `AdapterDiagnostic`, `ProjectionDiagnostic`, `DiagnosticItem`, or `SemanticDiagnosticResult` in touched package APIs.
- [ ] One canonical severity type is used consistently across syntax, semantic, and editor layers.
- [ ] No transitional compatibility symbols remain.
- [ ] Affected tests pass and enforce canonical names.

## Testing Strategy

- Run focused tests for semantify, volar, and core.
- Run typecheck for touched packages.
- Verify no old symbol references via workspace search.
