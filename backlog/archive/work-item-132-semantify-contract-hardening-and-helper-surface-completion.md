---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:132-semantify-contract-hardening-and-helper-surface-completion
title: '132: Semantify Contract Hardening and Helper Surface Completion'
summary: Finalize Semantify contract/profile extension coverage and strict validation across all target authoring feature domains.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 10
actual: 0
completed_date: '2026-05-22'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/163
  evidence:
    - '[[record-20260521-221758-132-semantify-contract-hardening-and-helper-surface-completion]]'
---

## Goal

Harden Semantify public contracts so helper-extension surfaces fully cover completion, definition, hover, diagnostics planning, semantic token planning, and formatting orchestration contracts.

## Background

Existing profile helpers cover only part of the feature surface. Final cutover requires explicit, typed extension contracts for every semantic capability that language-service and Volar consume.

## Scope

- Extend helper-extension kinds and metadata for full feature coverage.
- Tighten adapter/profile schema contracts and runtime validation.
- Enforce provenance requirements for feature-critical entities.
- Publish canonical contract expectations in package docs.

## Tasks

- [x] Extend helper extension kinds/types to include `semantic-token-provider` and `formatting-orchestrator`.
- [x] Add strict validation for adapter/profile compatibility, required fields, and unsupported helper capabilities.
- [x] Define and validate mandatory provenance attributes for nodes/edges that feed completion/hover/definition/highlighting/diagnostics.
- [x] Add typed contract tests for helper extension registration and invocation eligibility.
- [x] Update Semantify README and public type docs to projection-only contract language.

## Deliverables

- Updated Semantify public types with full helper-extension coverage.
- Runtime validation rules and tests for adapter/profile/helper compatibility.
- Contract documentation and examples aligned to final cutover shape.

## Acceptance Criteria

- [x] Helper extension contract includes `candidate-provider`, `definition-resolver`, `hover-renderer`, `diagnostic-planner`, `semantic-token-provider`, and `formatting-orchestrator`.
- [x] Invalid contract combinations fail deterministically with actionable diagnostics.
- [x] Provenance requirements for feature-critical projection entities are explicit and test-enforced.
- [x] Documentation no longer describes legacy compatibility APIs as active integration guidance.

## Validation

```bash
pnpm --filter @templjs/semantify test
pnpm --filter @templjs/semantify build
```
