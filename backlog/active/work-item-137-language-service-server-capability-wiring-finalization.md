---
'$schema': schemas/work-management/frontmatter/work-item.json
id: work-item:137-language-service-server-capability-wiring-finalization
title: '137: Language-Service and Server Capability Wiring Finalization'
summary: Finalize plugin and LSP capability wiring so all semantic features execute through projection-backed helper extensions.
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 8
actual: 0
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

- [ ] Register and wire semantic-token capabilities in language-service plugin registry and server handlers.
- [ ] Ensure completion, hover, definition, diagnostics, highlighting, and formatting orchestration flow through projection-backed extension contracts.
- [ ] Remove residual transport-layer semantic policy leakage.
- [ ] Add and stabilize in-process integration tests across all feature handlers.

## Deliverables

- Updated plugin and server wiring for full feature set.
- End-to-end integration coverage for all targeted authoring capabilities.

## Acceptance Criteria

- [ ] All targeted feature handlers are registered and functional through projection-backed execution.
- [ ] Language-service and server maintain transport-only ownership boundaries.
- [ ] In-process integration suite passes for completion, hover, definition, diagnostics, highlighting, and formatting.

## Relationships

- `depends_on`: [[work-item-134-volar-completion-hover-definition-graph-cutover]]
- `depends_on`: [[work-item-135-diagnostics-highlighting-projection-authority-cutover]]
- `depends_on`: [[work-item-136-formatting-orchestration-contract-host-delegation]]

## Validation

```bash
pnpm --filter @templjs/language-service test
pnpm --filter @templjs/language-server test
```
