---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:135-diagnostics-highlighting-projection-authority-cutover
title: '135: Diagnostics and Highlighting Projection Authority Cutover'
summary: Make projection/profile execution authoritative for diagnostics planning and semantic highlighting.
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: critical
estimated: 10
actual: 0
links:
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

- [ ] Implement `semantic-token-provider` helper extension execution and integrate with Volar semantic token provider.
- [ ] Ensure semantic token classification is sourced from projected graph/provenance entities.
- [ ] Route diagnostics planning through `diagnostic-planner` helper contracts.
- [ ] Preserve language-service transport remapping boundaries while removing semantic fallback policy from transport layers.
- [ ] Add integration tests for nested virtual-code remapping and zone-sensitive token/diagnostic behavior.

## Deliverables

- Projection-backed semantic token authority.
- Projection-backed diagnostics planning flow.
- Integration tests for highlighting and diagnostics remap correctness.

## Acceptance Criteria

- [ ] Semantic highlighting is driven by projected graph/provenance + helper extensions only.
- [ ] Diagnostics planning no longer depends on legacy Semantify compatibility semantics.
- [ ] Integration tests cover template/frontmatter and host remap scenarios with stable output.

## Relationships

- `depends_on`: [[work-item-133-semantify-runtime-determinism-and-provenance-strict-mode]]

## Validation

```bash
pnpm --filter @templjs/volar test
pnpm --filter @templjs/language-service test
```
