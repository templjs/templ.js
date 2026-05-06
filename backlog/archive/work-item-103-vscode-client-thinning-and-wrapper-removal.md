---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:103-vscode-client-thinning-and-wrapper-removal
title: '103: Thin VS Code client and remove server-wrapper feature ownership'
summary: Reduce vscode-templjs to activation/configuration/logging/transport while feature handlers live in language-service/server layers
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 6
actual: 1
completed_date: '2026-05-06'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/75
  evidence:
    - '[[record-103-vscode-client-thinning-and-wrapper-removal-evidence-1]]'
---

## Goal

Deliver Stage 6 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by making VS Code package a thin client only.

## Scope

- Remove manual completion/hover/definition/formatting handlers from server wrapper once service ownership is complete.
- Keep middleware only for logging and test instrumentation.
- Keep settings and dynamic configuration forwarding.

## Tasks

- [x] Remove manual authoring handlers from VS Code server wrapper.
- [x] Remove semantic active-document context hacks once server project state owns schema context.
- [x] Keep extension startup, configuration, commands, output channels, and transport wiring only.
- [x] Add integration assertions proving features come from language server/service layers.

## Acceptance Criteria

- [x] `src/extensions/vscode/src/**` contains no syntax-aware semantic ownership code.
- [x] VS Code extension integration suites remain green.
- [x] Extension behavior remains parity-safe for host and templ semantics.

## Relationships

- `depends_on`: [[work-item-099-language-package-split-and-entrypoint-migration]]
- `depends_on`: [[work-item-101-host-language-service-composition-cutover]]
- `depends_on`: [[work-item-102-semantic-routing-core-context-graph-cutover]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
