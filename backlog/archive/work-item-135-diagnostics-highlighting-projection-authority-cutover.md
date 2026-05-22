---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:135-diagnostics-highlighting-projection-authority-cutover
title: '135: Diagnostics and Highlighting Projection Authority Cutover'
summary: Make projection/profile execution authoritative for diagnostics planning and semantic highlighting.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 10
actual: 3
completed_date: '2026-05-22'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/170
  evidence:
    - '[[record-20260521-221758-135-diagnostics-highlighting-projection-authority-cutover]]'
---

## Goal

Shift diagnostics planning and semantic highlighting authority to deterministic projection/profile extensions, with no tokenization-era semantic fallback.

## Background

Diagnostics and semantic-token behavior currently span mixed authority paths. Final architecture requires projection outputs and helper contracts to define semantic meaning consistently.

## Scope

- Introduce and wire projection-backed semantic token planning.
- Route diagnostics planning through profile helper extension contracts.
- Remove semantic authority fallback paths based on legacy semantics.

## Tasks

- [x] Implement `semantic-token-provider` helper extension execution and integrate with Volar semantic token provider.
- [x] Ensure semantic token classification is sourced from projected graph/provenance entities.
- [x] Route diagnostics planning through `diagnostic-planner` helper contracts.
- [x] Preserve language-service transport remapping boundaries while removing semantic fallback policy from transport layers.
- [x] Add integration tests for nested virtual-code remapping and zone-sensitive token/diagnostic behavior.

## Deliverables

- Projection-backed semantic token authority.
- Projection-backed diagnostics planning flow.
- Integration tests for highlighting and diagnostics remap correctness.

## Progress Notes

- 2026-05-22: Removed legacy semantic-token fallback scanning path so parser-backed filter extraction is authoritative.
- 2026-05-22: Wired diagnostic source attribution through the `diagnostic-planner` helper metadata (`templjs.authoring.diagnostics`) and preserved base diagnostic remapping behavior.
- 2026-05-22: Added targeted branch-coverage tests in Volar to satisfy pre-push coverage gates for diagnostics, semantic token handling, and service-plugin mapping branches.
- 2026-05-22: PR #170 merged to `staging` (`88d46e340f47a032dbdf33e011c4c254d4e4f9b5`) with scope and validation complete; queued for backlog automation closure/archive.

## Acceptance Criteria

- [x] Semantic highlighting is driven by projected graph/provenance + helper extensions only.
- [x] Diagnostics planning no longer depends on legacy Semantify compatibility semantics.
- [x] Integration tests cover template/frontmatter and host remap scenarios with stable output.

## Relationships

- `depends_on`: [[work-item-133-semantify-runtime-determinism-and-provenance-strict-mode]]

## Validation

```bash
pnpm --filter @templjs/volar test
pnpm --filter @templjs/language-service test
```
