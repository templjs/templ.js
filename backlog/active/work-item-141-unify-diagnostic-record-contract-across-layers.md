---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:141-unify-diagnostic-record-contract-across-layers
title: '141: Unify Diagnostic Record Contract Across Layers'
summary: Establish one canonical diagnostic record contract across syntax, semantic, and editor surfaces
assignee: copilot
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: awaiting-review
priority: high
estimated: 10
actual: 0
links:
  evidence:
    - '[[record-20260523-044941-141-unify-diagnostic-record-contract-across-layers]]'
  pull_requests:
    - https://github.com/templjs/templ.js/pull/179
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

- [x] [src/packages/semantify/src/model/public-types.ts](src/packages/semantify/src/model/public-types.ts)
  - `ProjectionDiagnosticSeverity` -> `DiagnosticSeverity`
  - `AdapterDiagnostic` -> `SyntaxDiagnosticRecord`
  - `ProjectionDiagnostic` -> `SemanticDiagnosticRecord`
- [x] [src/packages/semantify/src/index.ts](src/packages/semantify/src/index.ts)
  - export `ProjectionDiagnosticSeverity` -> export `DiagnosticSeverity`
  - export `AdapterDiagnostic` -> export `SyntaxDiagnosticRecord`
  - export `ProjectionDiagnostic` -> export `SemanticDiagnosticRecord`
- [x] [src/packages/volar/src/diagnostic-types.ts](src/packages/volar/src/diagnostic-types.ts)
  - `DiagnosticItem` -> `SemanticDiagnosticRecord`
  - `DiagnosticOptions.baseDiagnostics` -> `DiagnosticOptions.baseSyntaxDiagnostics`
- [x] [src/packages/core/src/semantic/semantic-context.ts](src/packages/core/src/semantic/semantic-context.ts)
  - `SemanticDiagnosticResult` -> `SemanticDiagnosticRecord`
  - severity numeric type -> canonical `DiagnosticSeverity`

## Tasks

- [x] Replace diagnostic type symbols in semantify model and exports.
- [x] Replace diagnostic type symbols in volar diagnostics contracts.
- [x] Replace core semantic diagnostic naming and severity typing.
- [x] Update direct imports and internal references in touched packages.
- [x] Remove superseded symbols entirely (no compatibility aliases).
- [x] Add or update tests that enforce canonical type names at package boundaries.

## Deliverables

- Canonical diagnostic contract applied across packages.
- Removal of obsolete diagnostic symbols.
- Passing typecheck and package tests in touched areas.

## Acceptance Criteria

- [x] No remaining references to `ProjectionDiagnosticSeverity`, `AdapterDiagnostic`, `ProjectionDiagnostic`, `DiagnosticItem`, or `SemanticDiagnosticResult` in touched package APIs.
- [x] One canonical severity type is used consistently across syntax, semantic, and editor layers.
- [x] No transitional compatibility symbols remain.
- [x] Affected tests pass and enforce canonical names.

## Testing Strategy

- Run focused tests for semantify, volar, and core.
- Run typecheck for touched packages.
- Verify no old symbol references via workspace search.
