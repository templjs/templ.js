---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:137-language-service-server-capability-wiring-finalization
title: '137: Language-Service and Server Capability Wiring Finalization'
summary: Finalize plugin and LSP capability wiring so all semantic features execute through projection-backed helper extensions.
type: work-item
subtype: task
lifecycle: active
status: in-progress
status_reason: implementation-verified-awaiting-pr
priority: high
estimated: 8
actual: 2
links:
  evidence:
    - '[[record-20260521-221758-137-language-service-server-capability-wiring-finalization]]'
---

## Goal

Complete transport-layer wiring so language-service and language-server capabilities are fully aligned with projection-backed semantic execution for all required authoring features.

## Background

Feature providers currently have partial capability registration and mixed implementation ownership. Final cutover requires complete service-plugin and server handler alignment with helper extension execution.

## Scope

- Wire all required capability providers and handlers.
- Ensure projection-backed helper execution is used consistently.
- Keep semantic policy out of transport layers.

## Tasks

- [x] Register and wire semantic-token capabilities in language-service plugin registry and server handlers.
- [x] Ensure completion, hover, definition, diagnostics, highlighting, and formatting orchestration flow through projection-backed extension contracts.
- [x] Remove residual transport-layer semantic policy leakage.
- [x] Add and stabilize in-process integration tests across all feature handlers.

## Deliverables

- Updated plugin and server wiring for full feature set.
- End-to-end integration coverage for all targeted authoring capabilities.

## Progress Notes

- 2026-05-22: Added language-server semantic token request delegation for `textDocument/semanticTokens/full` and `textDocument/semanticTokens/range`, forwarding directly to Volar language-service semantic token APIs.
- 2026-05-22: Added bootstrap/in-process integration tests for semantic token full/range routing and validated handler coverage for completion, hover, definition, formatting, and semantic tokens.
- 2026-05-22: Validation passed: `pnpm --filter @templjs/language-service test` and `pnpm --filter @templjs/language-server test`.

## Acceptance Criteria

- [x] All targeted feature handlers are registered and functional through projection-backed execution.
- [x] Language-service and server maintain transport-only ownership boundaries.
- [x] In-process integration suite passes for completion, hover, definition, diagnostics, highlighting, and formatting.

## Relationships

- `depends_on`: [[work-item-134-volar-completion-hover-definition-graph-cutover]]
- `depends_on`: [[work-item-135-diagnostics-highlighting-projection-authority-cutover]]
- `depends_on`: [[work-item-136-formatting-orchestration-contract-host-delegation]]

## Validation

```bash
pnpm --filter @templjs/language-service test
pnpm --filter @templjs/language-server test
```
