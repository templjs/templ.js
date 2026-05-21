---
'$schema': schemas/work-management/frontmatter/work-item.json
id: work-item:136-formatting-orchestration-contract-host-delegation
title: '136: Formatting Orchestration Contract with Host Delegation'
summary: Define projection-aware formatting orchestration contracts while permanently keeping actual formatting delegated to host language services.
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 6
actual: 0
---

## Goal

Codify deterministic semantic orchestration boundaries for formatting while preserving workspace-consistent host formatter behavior as the permanent formatter authority.

## Background

You selected permanent host delegation for formatting to preserve consistency with workspace settings and host ecosystem behavior. This still requires explicit semantic contracts so orchestration is deterministic and architecture boundaries are clear.

## Scope

- Add formatting orchestration helper extension contract.
- Define semantic handoff payload to host formatter adapters.
- Keep edit generation and formatting policy in host services only.

## Tasks

- [ ] Add `formatting-orchestrator` helper extension contract and runtime invocation boundaries.
- [ ] Define deterministic semantic context payload for formatting orchestration.
- [ ] Integrate orchestration hooks in language-service formatting path without moving formatting policy into Semantify core.
- [ ] Add tests proving workspace formatter settings remain authoritative.
- [ ] Document permanent host-delegation policy and semantic orchestration responsibilities.

## Deliverables

- Formatting orchestration helper contract and adapters.
- Tests verifying host delegation behavior under semantic orchestration.
- Updated docs clarifying boundary ownership.

## Acceptance Criteria

- [ ] Formatting remains host delegated for all produced edits.
- [ ] Semantic orchestration contract exists, is deterministic, and is tested.
- [ ] No Semantify core code path encodes formatter-specific policy decisions.

## Relationships

- `depends_on`: [[work-item-132-semantify-contract-hardening-and-helper-surface-completion]]

## Validation

```bash
pnpm --filter @templjs/language-service test
pnpm --filter @templjs/language-server test
```
