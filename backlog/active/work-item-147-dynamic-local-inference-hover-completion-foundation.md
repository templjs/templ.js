---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:147-dynamic-local-inference-hover-completion-foundation
title: '147: Dynamic Local Inference Foundation for Hover and Completion'
summary: Add deterministic inferred-path authority for dynamic local hover and completion without schema-only dependence
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implementation-complete
priority: high
estimated: 16
actual: 4
assignee: copilot
links:
  evidence:
    - '[[record-20260525-120000-147-dynamic-local-inference-hover-completion-foundation]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/187'
    - 'https://github.com/templjs/templ.js/pull/189'
---

## Goal

Provide deterministic inferred-path behavior for dynamic locals so alias and member hovers and completions remain useful even when schema authority is absent or partial.

## Background

Current hover and completion behavior relies on schema-backed path details and canonical alias expansion. This works for strongly typed schema contexts but is weaker for dynamic locals created by set and for constructs that introduce literal-derived structures.

## Scope

- Add local dynamic-shape inference boundaries for set and for-introduced locals.
- Emit inferred semantic nodes with deterministic ordering and provenance.
- Update read paths to resolve inferred hover and completion candidates first, then schema fallback.
- Preserve existing alias-token hover semantics and schema-backed behavior.
- Add malformed-template fallback guardrails that avoid misleading results.

## Tasks

- [x] Define inferred-shape rules and canonical path normalization for dynamic locals.
- [x] Extend core template binding extraction metadata for inferred member paths.
- [x] Extend semantify template adapter outputs to emit inferred-path nodes.
- [x] Update volar context graph read APIs for inferred hover and completion.
- [x] Update intellisense hover and completion branches to consume inferred paths.
- [x] Add malformed-template confidence guardrails for best-effort behavior.
- [x] Add focused tests for dynamic locals across core, semantify, and volar.

## Deliverables

- Deterministic inferred-path semantic contract for dynamic locals.
- Hover and completion behavior improvements for dynamic local references.
- Regression tests covering dynamic-local and malformed-template cases.

## Acceptance Criteria

- [x] Hover resolves alias member paths to inferred details when schema is unavailable.
- [x] Completion offers inferred member candidates for in-scope dynamic locals.
- [x] Mixed schema-plus-dynamic templates preserve existing schema behavior.
- [x] Malformed templates degrade safely to deterministic null or best-effort outputs.
- [x] Targeted package tests pass for the new dynamic-local behavior.

## Testing Strategy

- Add and run targeted tests in core binding extraction and volar intellisense suites.
- Add malformed-template fixtures that verify deterministic fallback behavior.
- Run impacted package type-check and test commands for core, semantify, and volar.

## Relationships

- `related`: [[work-item-131-semantify-projection-full-cutover-epic]]
- `related`: [[work-item-146-remove-legacy-artifacts-and-finalize-diagnostics-architecture]]

## Implementation Notes

- 2026-05-25: Started Phase 1 with inferred property completion for `set` object literals in Volar completion fallback when schema child completions are unavailable.
- 2026-05-26: Completed dynamic-local inference for `for`-introduced locals by extending core binding extraction to emit inferred paths for inferable loop aliases and wiring Volar completion/definition read paths to consume them.
- 2026-05-26: Added focused tests across core and volar for single-alias `for` object-literal inferred completion/definition behavior, plus key/value guardrails.
