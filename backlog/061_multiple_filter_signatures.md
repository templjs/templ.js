---
id: wi-061
type: work-item
subtype: story
lifecycle: draft
title: '061: Support Multiple Built-in Filter Signatures'
status: proposed
priority: medium
estimated: 6
actual: 0
assignee: ''
links:
  depends_on:
    - '[[008_query_engine]]'
    - '[[020_documentation]]'
---

## Goal

Support overload-aware built-in filter signature access so callers can retrieve all registered query-engine signatures instead of only the first signature for each function.

## Background

`getBuiltinFilterSignatures()` in `@templjs/core` currently exposes only `signatures[0]` from query-engine metadata. That is sufficient for simple consumers, but it drops overload information that may be needed for IDE hovers, richer completion details, documentation generation, and future public API consumers.

We recently documented this limitation explicitly. This work item tracks the follow-up design and implementation needed to expose overloads in a stable way without breaking existing callers.

## Scope

- Add an overload-aware API alongside `getBuiltinFilterSignatures()` rather than widening the existing return type
- Preserve backward compatibility for current callers that expect one signature per filter name
- Expose all query-engine function signatures for built-in filters in a documented, cacheable shape
- Update downstream consumers and tests if they should become overload-aware

## Tasks

- [ ] Audit current callers of `getBuiltinFilterSignatures()` and query metadata
- [ ] Add an additive overload-aware export (for example `getBuiltinFilterOverloads()`)
- [ ] Define compatibility strategy for existing single-signature callers
- [ ] Implement overload-aware export in `@templjs/core`
- [ ] Update affected Volar/VS Code consumers if richer signature metadata is useful there
- [ ] Add tests covering functions with multiple signatures
- [ ] Update API documentation and migration notes

## Acceptance Criteria

- [ ] `@templjs/core` exposes a documented additive API for retrieving all built-in filter signatures for overloaded functions
- [ ] `getBuiltinFilterSignatures()` remains backward compatible and continues to serve the single-signature convenience use case
- [ ] At least one test covers a function with multiple registered signatures and verifies all overloads are accessible
- [ ] Public API docs clearly distinguish single-signature convenience access from full overload-aware metadata access
- [ ] No regressions in current query-engine metadata consumers

## Implementation Notes

- Prefer an additive export such as `getBuiltinFilterOverloads()` so callers that only need `signatures[0]` can keep using `getBuiltinFilterSignatures()` unchanged.
- Keep the query engine metadata (`createQueryEngine().getMetadata().functions`) as the source of truth; new exports should adapt that shape rather than duplicate metadata generation logic.
- If caching is added, cache both the single-signature and overload-aware forms explicitly so consumers do not pay repeated conversion costs.

## Testing Strategy

- Add unit coverage in `@templjs/core` for overload-aware signature export behavior.
- Verify single-signature compatibility remains intact for current consumers.
- Add or update integration coverage where IDE-facing consumers depend on signature metadata.
