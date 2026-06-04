---
id: adr-011
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-011: Work-Item Transition Contract and Reason Semantics'
---

## Status

Accepted - May 2026

## Context

Work-item lifecycle enforcement currently validates schema shape and selected invariants, but transition validation in the linter has been status-only and disabled. At the same time, status-reason semantics, rollback policy, strict-mode behavior, and consumer severity authority have been clarified in [CONTEXT.md](../CONTEXT.md).

This created drift risk between prose decisions and executable behavior.

## Decision

Adopt compositional canonicality for the lifecycle contract.

- [schemas/work-management/frontmatter/work-item.json](../../schemas/work-management/frontmatter/work-item.json)
- [schemas/work-management/workflows/default/status-definitions.schema.json](../../schemas/work-management/workflows/default/status-definitions.schema.json)
- [schemas/work-management/workflows/default/transition-profile.json](../../schemas/work-management/workflows/default/transition-profile.json)
- [schemas/work-management/workflows/default/status-policy.schema.json](../../schemas/work-management/workflows/default/status-policy.schema.json)

The work-item frontmatter schema is the composition entrypoint, while workflow files are the canonical source for status vocabulary, reason taxonomy, category/connectivity mappings, and transitions consumed by schema generation and evaluator runtime.

### 1. Canonical Status Set

The canonical status set is:

- proposed
- ready
- in-progress
- ready-for-review
- closed

### 2. Canonical Status-Reason Taxonomy

Status reasons are declared per status in [schemas/work-management/workflows/default/status-definitions.schema.json](../../schemas/work-management/workflows/default/status-definitions.schema.json) and projected into [schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json](../../schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json).

Known reasons include intake, execution, review, and closure outcomes used by current repository data and lifecycle policy. Default workflow enforcement is known-reason-only. Unconstrained freeform reasons are not part of the canonical contract.

### 3. Category Model and Wildcards

Each known reason maps to one category. Rules are category-driven and allow wildcard selectors in rule authoring.

- Categories include: intake, planning, execution, review, completed, decision.
- Wildcards are authoring sugar only; runtime matching is deterministic against resolved category/reason/status selectors.

### 4. Full Forward and Backward Matrix

Forward progression (category-aware):

- proposed -> ready
- ready -> in-progress
- in-progress -> ready-for-review
- ready-for-review -> closed

Decision closure is also allowed from active states to closed when target reason category is decision.

Backward matrix (active-state rollback) is explicitly allowed as:

- ready-for-review -> in-progress
- in-progress -> ready
- in-progress -> proposed
- ready -> proposed
- ready-for-review -> proposed (needs-info)

No backward rollback jump to closed is allowed.

### 5. Allow-Only Matching and Precedence

Transition evaluation is allow-only.

- Effective acceptance is based on matched allow rules.
- Deterministic rule precedence order is: reason selector, then category selector, then status-only selector.
- No deny rules are defined in this phase.

### 6. Connectivity Model

Reason connectivity classes are:

- start
- intermediate
- end

Undeclared reasons default to intermediate declaratively in the contract.

Self-loop status transitions are treated as non-participatory for graph connectivity accounting and may produce semantic warnings when they indicate suspicious lifecycle churn.

### 7. Diagnostic Taxonomy

Diagnostics split into:

- Syntax/domain violations: errors.
- Semantic lifecycle smells: warnings.

Examples of semantic warnings include suspicious-but-valid transitions such as reason churn within the same status without status progression.

### 8. Strict Mode and Consumer Policy Composition

The linter supports optional --strict behavior:

- Semantic warnings are promoted to errors only when consumer policy has not explicitly configured that diagnostic category to warn-or-lower.
- Consumer severity configuration remains authoritative.
- When strict escalation is masked by consumer policy, the linter emits an explicit masking notice.

Severity composition is evaluated with diagnostic-code precedence first, then semantic-category policy for semantic findings.

### 9. Evaluator Boundary

Evaluator architecture is split:

- Local generic transition graph core: rule matching, selector resolution, precedence ordering.
- Lifecycle policy layer: work-item-specific rules, reason connectivity semantics, and diagnostics.

## Consequences

### Positive

- One compositional schema-first lifecycle contract shared by schema generation and runtime validation.
- Reason-level fidelity in transition validation.
- Deterministic strict behavior that preserves consumer authority.

### Negative

- Transition-policy updates now require coordinated workflow profile, generated schema, and evaluator updates.
- Legacy archive files remain pinned to baseline historical schemas and are not automatically upgraded to default known-reason-only policy.

## References

- [CONTEXT.md](../CONTEXT.md)
- [schemas/work-management/frontmatter/work-item.json](../../schemas/work-management/frontmatter/work-item.json)
- [schemas/work-management/workflows/default/status-definitions.schema.json](../../schemas/work-management/workflows/default/status-definitions.schema.json)
- [schemas/work-management/workflows/default/transition-profile.json](../../schemas/work-management/workflows/default/transition-profile.json)
- [schemas/work-management/workflows/default/status-policy.schema.json](../../schemas/work-management/workflows/default/status-policy.schema.json)
- [scripts/ci/lint-frontmatter.ts](../../scripts/ci/lint-frontmatter.ts)
