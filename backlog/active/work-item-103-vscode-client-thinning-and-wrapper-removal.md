---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:103-vscode-client-thinning-and-wrapper-removal
title: '103: Thin VS Code client and remove server-wrapper feature ownership'
summary: Reduce vscode-templjs to activation/configuration/logging/transport while feature handlers live in language-service/server layers
type: work-item
subtype: task
lifecycle: active
status: ready
priority: high
estimated: 6
actual: 0
---

## Goal

Deliver Stage 6 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by making VS Code package a thin client only.

## Scope

- Remove manual completion/hover/definition/formatting handlers from server wrapper once service ownership is complete.
- Keep middleware only for logging and test instrumentation.
- Keep settings and dynamic configuration forwarding.

## Tasks

- [ ] Remove manual authoring handlers from VS Code server wrapper.
- [ ] Remove semantic active-document context hacks once server project state owns schema context.
- [ ] Keep extension startup, configuration, commands, output channels, and transport wiring only.
- [ ] Add integration assertions proving features come from language server/service layers.

## Acceptance Criteria

- [ ] `src/extensions/vscode/src/**` contains no syntax-aware semantic ownership code.
- [ ] VS Code extension integration suites remain green.
- [ ] Extension behavior remains parity-safe for host and templ semantics.

## Relationships

- `depends_on`: [[work-item-099-language-package-split-and-entrypoint-migration]]
- `depends_on`: [[work-item-101-host-language-service-composition-cutover]]
- `depends_on`: [[work-item-102-semantic-routing-core-context-graph-cutover]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
