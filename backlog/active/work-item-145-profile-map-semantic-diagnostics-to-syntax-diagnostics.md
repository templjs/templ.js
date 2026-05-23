---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:145-profile-map-semantic-diagnostics-to-syntax-diagnostics
title: '145: Profile-Map Semantic Diagnostics to Syntax Diagnostics'
summary: Define and implement deterministic semantic diagnostics mapping from syntax-layer diagnostics
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 12
actual: 0
assignee: copilot
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

- [ ] [src/packages/core/src/parser/types.ts](src/packages/core/src/parser/types.ts)
  - `ParseError.type` -> `ParseDiagnosticPhase`
  - phase literals `syntax` and `recovery` and `validation` -> `lexical` and `parse` and `semantic`
- [ ] [src/packages/core/src/index.ts](src/packages/core/src/index.ts)
  - `validateTemplate` return `errors: string[]` -> `syntaxDiagnostics: SyntaxDiagnosticRecord[]`
- [ ] [src/packages/semantify/src/projector/index.ts](src/packages/semantify/src/projector/index.ts)
  - normalize adapter output diagnostics to `SyntaxDiagnosticRecord`
  - emit runtime strict diagnostics as `SemanticDiagnosticRecord` with phase `projection` and origin `runtime`
- [ ] [src/packages/volar/src/diagnostic-provider.ts](src/packages/volar/src/diagnostic-provider.ts)
  - consume syntax diagnostics and emit semantic diagnostics under canonical record contract
- [ ] [src/packages/volar/src/diagnostic-remapping.ts](src/packages/volar/src/diagnostic-remapping.ts)
  - remapping signatures `DiagnosticItem` -> `SemanticDiagnosticRecord`

## Tasks

- [ ] Define canonical parse diagnostic phase values.
- [ ] Refactor core `validateTemplate` output contract.
- [ ] Implement profile-level mapping of syntax diagnostics to semantic diagnostics.
- [ ] Refactor volar diagnostic remapping and provider signatures.
- [ ] Update tests for phase, origin, and severity mapping semantics.
- [ ] Remove transitional string-based diagnostic pathways.

## Deliverables

- Syntax diagnostics emitted as structured records.
- Semantic diagnostics layer mapped from syntax diagnostics using profile semantics.
- Unified diagnostics flow from parser to volar consumer.

## Acceptance Criteria

- [ ] Core `validateTemplate` returns structured syntax diagnostics.
- [ ] Semantify projector emits semantic diagnostics with phase and origin metadata.
- [ ] Volar consumes canonical semantic diagnostics without shape translation drift.
- [ ] Tests pass for parser, projector, and diagnostics provider flows.

## Testing Strategy

- Run core parser and validation tests.
- Run semantify adapter and projector tests.
- Run volar diagnostics and service plugin tests with regression assertions.
