---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:111-service-plugin-contract-and-boundaries
title: '111: Define service-plugin contract and language-domain boundaries'
summary: Establish clear boundary contracts between extension orchestration and language-service plugins, including capability publication and runtime planning separation.
type: work-item
subtype: task
lifecycle: active
status: ready
priority: medium
estimated: 3
actual: 0
---

## Goal

Define explicit contracts that make extension orchestration transport-only while language-service plugins own all language-domain behavior and runtime planning.

## Background

PoC iteration introduced language-specific leakage in extension code (e.g., `MarkdownlintHostRuntime` protocol concerns, markdown document gating helpers). ADR-009 requires clearer boundaries to reduce coupling and enable future adapter expansion.

## Scope

- Define the service-plugin contract: what capabilities a plugin must publish.
- Document runtime planning responsibilities (e.g., "if markdownlint isn't registered with `.md`, don't engage markdownlint plugin for diagnostics").
- Establish boundary rules: extension = transport/config only; plugins = language-domain logic.
- Document colocated vs. separate-file guidance for plugin implementations.

## Tasks

- [ ] Define service-plugin base contract (capabilities, requirements, lifecycle methods).
- [ ] Document capability publication schema (e.g., registered file types, supported features).
- [ ] Define runtime planning contract and decision-making interface.
- [ ] Document extension boundary: transport DTOs only, no language-specific symbols.
- [ ] Create boundary tests (linting rules or tests) that detect prohibited cross-layer imports.
- [ ] Update ADR-009 and architecture docs with ownership boundaries and contract examples.
- [ ] Document colocated vs. separate-file guidance (trivial: colocate in `service-plugins.ts`; non-trivial >20 lines: separate files).

## Deliverables

- Service-plugin contract specification.
- Extension/plugin boundary rules and enforcement tests.
- Updated ADR-009 and architecture documentation.
- Guidance for future adapter implementations.

## Acceptance Criteria

- [ ] Service-plugin contract is clearly defined and documented.
- [ ] Extension orchestration code contains no language-specific policy logic.
- [ ] Boundary tests or linting rules detect prohibited imports.
- [ ] All existing plugins align with the new contract.
- [ ] Documentation provides clear examples for future adapter implementations.
- [ ] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-108-adapter-runtime-manifest-and-deferred-resolution]]
