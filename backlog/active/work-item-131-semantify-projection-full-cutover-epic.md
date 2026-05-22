---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:131-semantify-projection-full-cutover-epic
title: '131: Semantify Projection Full Cutover Epic'
summary: Fully adopt deterministic Semantify projection and provenance as the semantic authority for authoring features and remove all transition artifacts.
type: work-item
subtype: epic
lifecycle: active
status: in-progress
status_reason: child-lane-complete-awaiting-automation-closeout
priority: critical
estimated: 32
actual: 0
links:
  evidence:
    - '[[record-20260521-221758-131-semantify-projection-full-cutover-epic]]'
---

## Goal

Deliver full, irreversible cutover to Semantify semantic contract/profile plus projection rules so graph plus provenance is the only semantic authority for hover, definition, completion, diagnostics, and highlighting, while formatting remains host delegated with explicit semantic orchestration boundaries.

## Background

`WI-125` through `WI-130` established and partially integrated projection foundations, but compatibility helpers, migration shims, and mixed authority still exist across Semantify, Volar, language-service, and language-server surfaces.

This epic supersedes the archived migration sequence by enforcing a strict final state:

- no legacy compatibility APIs,
- no mixed semantic authority,
- no transition-path docs/tests,
- deterministic graph and provenance as first-class system contracts.

## Scope

- Finalize Semantify helper-extension contract coverage for all required feature domains.
- Cut Volar and language-service to projection/profile extension execution only.
- Complete semantic-token authority cutover to projected graph/provenance.
- Keep formatting host delegated permanently, with explicit semantic orchestration contract only.
- Remove all legacy Semantify transition artifacts and obsolete migration behavior.
- Validate deterministic, reproducible projection output and end-to-end IDE feature parity.

## Tasks

- [x] Execute `WI-132` through `WI-139` in the defined phase order.
- [x] Enforce the dependency graph and parallel lane boundaries in this epic.
- [x] Ensure each child item contributes direct evidence toward final legacy removal.
- [x] Ensure full validation matrix passes before closing this epic.
- [x] Handoff final evidence collation and closure automation inputs without manual archive shortcuts.

## Acceptance Criteria

- [x] `WI-132` through `WI-139` are completed with acceptance criteria checked.
- [x] No source or tests reference legacy Semantify compatibility surfaces (`createSemantifyServices`, `resolveContext`, `resolveReferences`, `planCandidates`).
- [x] Hover, definition, completion, diagnostics, and semantic highlighting execute through projection/profile extensions and provenance-backed graph reads.
- [x] Formatting behavior remains host delegated and respects workspace formatter configuration while using semantic orchestration hooks only.
- [x] Determinism and reproducibility gates pass for projection output under fixed inputs.
- [x] Repo-level validation matrix succeeds (`lint:frontmatter`, `type-check`, `test`, `build`).

## Child Tasks

- [x] [[work-item-132-semantify-contract-hardening-and-helper-surface-completion]]
- [x] [[work-item-133-semantify-runtime-determinism-and-provenance-strict-mode]]
- [x] [[work-item-134-volar-completion-hover-definition-graph-cutover]]
- [x] [[work-item-135-diagnostics-highlighting-projection-authority-cutover]]
- [x] [[work-item-136-formatting-orchestration-contract-host-delegation]]
- [x] [[work-item-137-language-service-server-capability-wiring-finalization]]
- [x] [[work-item-138-legacy-artifact-purge-and-api-surface-cleanup]]
- [x] [[work-item-139-final-verification-performance-gate-and-evidence-collation]]

## Relationships

- `related`: [[work-item-125-semantify-projection-architecture-migration-epic]]
- `related`: [[work-item-126-context-graph-primitive-and-provenance-contracts]]
- `related`: [[work-item-127-semantify-adapter-and-profile-contract-surface]]
- `related`: [[work-item-128-semantify-projection-runtime-and-dsl-foundation]]
- `related`: [[work-item-129-templjs-template-and-schema-profile-integration]]
- `related`: [[work-item-130-language-service-helper-extension-cutover]]

## Implementation Notes

- This epic is the sequencing authority for final cutover and artifact removal.
- Any newly discovered blocker should be captured in a dedicated work item linked back via `related`, without diluting child scope.
- Keep feature ownership boundaries consistent with ADR-009 and package AGENTS instructions.
