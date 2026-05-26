---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:148-dynamic-local-definition-to-literal-targeting
title: '148: Dynamic Local Definition Targeting to Literal Source Spans'
summary: Resolve dynamic local member definitions to inferred literal declaration spans with deterministic fallback semantics
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 24
actual: 0
assignee: copilot
links:
  evidence:
    - '[[record-20260525-120500-148-dynamic-local-definition-to-literal-targeting]]'
---

## Goal

Enable definition requests for dynamic local member paths to jump to concrete local literal declaration spans when inferable, while preserving reliable fallback behavior.

## Background

Alias canonicalization currently maps references such as x.name toward canonical paths, but definition targets are generally schema oriented. Dynamic locals derived from literals need source-span mapping so definition can point to the originating local declaration.

## Scope

- Add inferred definition-target contracts for dynamic local members.
- Add source-span mapping from literal members to referenced alias-member paths.
- Update definition resolution to prioritize inferred literal targets before schema targets where confidence is sufficient.
- Harden malformed-template behavior with explicit confidence thresholds.
- Add regression coverage for nested aliases, mixed contexts, and partial templates.

## Tasks

- [ ] Extend semantify public types to support inferred definition target metadata.
- [ ] Extend context graph definition resolution for inferred literal targets.
- [ ] Update volar definition flow to resolve inferred local targets first.
- [ ] Add deterministic fallback ordering for low-confidence malformed states.
- [ ] Add tests for nested alias, mixed schema/dynamic, and malformed scenarios.
- [ ] Update architecture and API docs for inferred definition precedence.

## Deliverables

- Inferred definition-target contract and implementation for dynamic locals.
- Definition navigation to local literal source spans where inferable.
- Regression tests and documentation for precedence and fallback behavior.

## Acceptance Criteria

- [ ] Alias member definition requests resolve to local literal property spans when inferable.
- [ ] Schema fallback remains intact when inferred source targets are unavailable.
- [ ] Missing end tags and partial statements follow deterministic fallback rules.
- [ ] Targeted tests demonstrate stable behavior across nested and mixed contexts.
- [ ] Docs describe inferred-first definition precedence and fallback conditions.

## Testing Strategy

- Add and run definition-focused tests in volar intellisense suites.
- Add fixtures covering nested loops, filtered iterables, and malformed templates.
- Run impacted package type-check and test commands for semantify and volar.

## Relationships

- `depends_on`: [[work-item-147-dynamic-local-inference-hover-completion-foundation]]
- `related`: [[work-item-131-semantify-projection-full-cutover-epic]]
- `related`: [[work-item-146-remove-legacy-artifacts-and-finalize-diagnostics-architecture]]
