---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:136-formatting-orchestration-contract-host-delegation
title: '136: Formatting Orchestration Contract with Host Delegation'
summary: Define projection-aware formatting orchestration contracts while permanently keeping actual formatting delegated to host language services.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation-underway
priority: high
estimated: 6
actual: 3
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/171
  evidence:
    - '[[record-20260521-221758-136-formatting-orchestration-contract-host-delegation]]'
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

- [x] Add `formatting-orchestrator` helper extension contract and runtime invocation boundaries.
- [x] Define deterministic semantic context payload for formatting orchestration.
- [x] Integrate orchestration hooks in language-service formatting path without moving formatting policy into Semantify core.
- [x] Add tests proving workspace formatter settings remain authoritative.
- [x] Document permanent host-delegation policy and semantic orchestration responsibilities.

## Deliverables

- Formatting orchestration helper contract and adapters.
- Tests verifying host delegation behavior under semantic orchestration.
- Updated docs clarifying boundary ownership.

## Progress Notes

- 2026-05-22: Added deterministic formatting orchestration contract metadata resolver in language-service runtime-manifest APIs and exported it for integration/use in orchestration plumbing.
- 2026-05-22: Added language-service regression coverage to assert the resolved orchestration contract metadata shape while preserving host-delegated formatting behavior.
- 2026-05-22: PR #171 merged to `staging` (`9ca17277370d47723194a76054565bc5d64e1209`) delivering runtime-manifest contract surface and regression coverage for contract metadata.
- 2026-05-22: Verified completion state is partial; remaining scope is formatting-path orchestration hook integration, explicit workspace-authority behavior assertions, and documentation updates.
- 2026-05-22: Added runtime formatting orchestration hook emission in `templjs-prettier-host` execution path and kept edit generation delegated to host formatter providers.
- 2026-05-22: Added targeted language-service tests for orchestration hook payload emission and formatter-language authority precedence from workspace initialization options.
- 2026-05-22: Documented permanent formatting boundary ownership in architecture docs and validated `@templjs/language-service` test/build plus docs/frontmatter lint.

## Acceptance Criteria

- [x] Formatting remains host-delegated for all produced edits.
- [x] Semantic orchestration contract exists, is deterministic, and is tested.
- [x] No Semantify core code path encodes formatter-specific policy decisions.

## Relationships

- `depends_on`: [[work-item-132-semantify-contract-hardening-and-helper-surface-completion]]

## Validation

```bash
pnpm --filter @templjs/language-service test
pnpm --filter @templjs/language-server test
```
