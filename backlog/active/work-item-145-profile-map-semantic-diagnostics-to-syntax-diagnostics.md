---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:145-profile-map-semantic-diagnostics-to-syntax-diagnostics
title: '145: Profile-Map Semantic Diagnostics to Syntax Diagnostics'
summary: Define and implement deterministic semantic diagnostics mapping from syntax-layer diagnostics
assignee: copilot
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation-complete-awaiting-pr
priority: high
estimated: 12
actual: 10
links:
  evidence:
    - '[[record-20260523-044941-145-profile-map-semantic-diagnostics-to-syntax-diagnostics]]'
---

## Goal

Create a clearly defined semantic diagnostics layer that is profile-mapped to syntax diagnostics emitted by the syntax layer.

## Execution Dependencies

- Depends on `work-item:141-unify-diagnostic-record-contract-across-layers`.
- Depends on `work-item:142-cutover-diagnostic-provider-capability-naming`.
- Depends on `work-item:143-unify-semantic-zone-vocabulary-metadata-content-template`.

## Scope

- Replace string-only syntax validation outputs with structured syntax diagnostics.
- Profile-map syntax diagnostics into semantic diagnostics in semantify projector flow.
- Ensure volar consumes unified semantic diagnostics directly.

## File-by-File Rename Checklist

- [x] [src/packages/core/src/parser/types.ts](src/packages/core/src/parser/types.ts)
  - `ParseError.type` -> `ParseDiagnosticPhase`
  - phase literals `syntax` and `recovery` and `validation` -> `lexical` and `parse` and `semantic`
- [x] [src/packages/core/src/index.ts](src/packages/core/src/index.ts)
  - `validateTemplate` return `errors: string[]` -> `syntaxDiagnostics: SyntaxDiagnosticRecord[]`
- [x] [src/packages/semantify/src/projector/index.ts](src/packages/semantify/src/projector/index.ts)
  - normalize adapter output diagnostics to `SyntaxDiagnosticRecord`
  - emit runtime strict diagnostics as `SemanticDiagnosticRecord` with phase `projection` and origin `runtime`
- [x] [src/packages/volar/src/diagnostic-provider.ts](src/packages/volar/src/diagnostic-provider.ts)
  - consume syntax diagnostics and emit semantic diagnostics under canonical record contract
- [x] [src/packages/volar/src/diagnostic-remapping.ts](src/packages/volar/src/diagnostic-remapping.ts)
  - remapping signatures `DiagnosticItem` -> `SemanticDiagnosticRecord`

## Tasks

- [x] Define canonical parse diagnostic phase values.
- [x] Refactor core `validateTemplate` output contract.
- [x] Implement profile-level mapping of syntax diagnostics to semantic diagnostics.
- [x] Refactor volar diagnostic remapping and provider signatures.
- [x] Update tests for phase, origin, and severity mapping semantics.
- [x] Remove transitional string-based diagnostic pathways.

## Deliverables

- Syntax diagnostics emitted as structured records.
- Semantic diagnostics layer mapped from syntax diagnostics using profile semantics.
- Unified diagnostics flow from parser to volar consumer.

## Acceptance Criteria

- [x] Core `validateTemplate` returns structured syntax diagnostics.
- [x] Semantify projector emits semantic diagnostics with phase and origin metadata.
- [x] Volar consumes canonical semantic diagnostics without shape translation drift.
- [x] Tests pass for parser, projector, and diagnostics provider flows.

## Testing Strategy

- Run core parser and validation tests.
- Run semantify adapter and projector tests.
- Run volar diagnostics and service plugin tests with regression assertions.
