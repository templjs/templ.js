---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:133-semantify-runtime-determinism-and-provenance-strict-mode
title: '133: Semantify Runtime Determinism and Provenance Strict Mode'
summary: Enforce deterministic projection output and strict provenance guarantees for all feature-critical semantic entities.
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: awaiting-review
priority: high
estimated: 8
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/166
  evidence:
    - '[[record-20260521-221758-133-semantify-runtime-determinism-and-provenance-strict-mode]]'
---

## Goal

Guarantee stable, reproducible graph/provenance projection behavior under equivalent inputs and strict contract mode.

## Background

The final cutover depends on deterministic runtime behavior. Any remaining non-determinism in ordering, IDs, or provenance completeness undermines reproducibility and confidence for downstream tooling.

## Scope

- Add strict-mode runtime checks and deterministic ordering assertions.
- Guarantee ID stability for semantically identical adapter/profile inputs.
- Enforce provenance completeness and predictable serialization.

## Tasks

- [x] Add strict-mode projection runtime option and failure diagnostics for non-deterministic or incomplete outputs.
- [x] Assert stable ordering for projected nodes/edges/provenance serialization.
- [x] Add deterministic snapshot tests that compare repeated runs over fixed fixtures.
- [x] Add provenance completeness checks for entities used by completion, hover, definition, diagnostics, and semantic tokens.
- [x] Document strict-mode expectations and debugging guidance.

## Deliverables

- Strict-mode runtime behavior and diagnostics.
- Determinism test fixtures and repeatability assertions.
- Provenance completeness guardrails.

## Acceptance Criteria

- [x] Repeated projection runs on fixed fixtures produce byte-stable graph/provenance snapshots.
- [x] Strict mode fails fast when required provenance data is missing or malformed.
- [x] Determinism tests are part of package validation and block regressions.

## Relationships

- `depends_on`: [[work-item-132-semantify-contract-hardening-and-helper-surface-completion]]

## Validation

```bash
pnpm --filter @templjs/semantify test
pnpm --filter @templjs/semantify build
```
