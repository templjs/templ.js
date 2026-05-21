---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:140-adapter-version-range-semver-caret-compliance
title: '140: Adapter Version Range Semver Caret Compliance'
summary: Replace simplified adapterVersionRange caret handling with semver-accurate range validation in Semantify adapter/profile compatibility checks.
type: work-item
subtype: bug
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 3
actual: 0
links:
  evidence:
    - '[[record-20260521-221758-140-adapter-version-range-semver-caret-compliance]]'
---

## Goal

Ensure `adapterVersionRange` validation uses semver-correct behavior so compatibility checks are accurate for caret ranges (including `0.x` semantics).

## Background

Copilot feedback on PR `#163` identified that current caret handling compares only major version, which can incorrectly accept incompatible versions (for example `^1.2.0` vs `1.0.0`, and `^0.9.0` behavior).

Tracking moved from remote issue `#164` into local backlog work management for execution alongside the Semantify full-cutover lane.

## Scope

- Replace simplified range matching with semver-accurate evaluation.
- Add regression tests for caret and non-caret version ranges.
- Ensure diagnostics remain actionable when version checks fail.

## Tasks

- [ ] Replace ad-hoc `adapterVersionRange` comparison logic with semver-accurate range checks.
- [ ] Add tests covering `^1.2.0`, `^0.9.0`, exact versions, and non-matching ranges.
- [ ] Verify compatibility diagnostics include adapter id, actual version, and expected range.

## Deliverables

- Updated version-range compatibility implementation.
- Regression tests for semver range behavior.
- Evidence of passing Semantify package tests.

## Acceptance Criteria

- [ ] `adapterVersionRange` checks match semver expectations for caret and exact ranges.
- [ ] Prior false-positive compatibility cases now fail deterministically.
- [ ] Semantify tests pass with new range-behavior coverage.

## Relationships

- `depends_on`: [[work-item-132-semantify-contract-hardening-and-helper-surface-completion]]
- `related`: [[work-item-133-semantify-runtime-determinism-and-provenance-strict-mode]]

## Validation

```bash
pnpm --filter @templjs/semantify test
pnpm --filter @templjs/semantify build
```
