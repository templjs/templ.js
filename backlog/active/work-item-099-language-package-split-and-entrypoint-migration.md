---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:099-language-package-split-and-entrypoint-migration
title: '099: Split language packages and migrate server/service/core entrypoints'
summary: Create language-core, language-service, and language-server package boundaries and move current VS Code-owned entrypoints into reusable packages
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
priority: high
estimated: 8
actual: 7
links:
  evidence:
    - '[[record-099-language-package-split-and-entrypoint-migration-evidence-1]]'
---

## Goal

Deliver Stage 2 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by splitting current extension-owned architecture into package-owned entrypoints.

## Scope

- Scaffold `@templjs/language-core`, `@templjs/language-service`, and `@templjs/language-server`.
- Move language plugin factory from `@templjs/volar` to `@templjs/language-core`.
- Move service plugin factory from `src/extensions/vscode/src/service-plugins.ts` to `@templjs/language-service`.
- Move server bootstrap from `src/extensions/vscode/src/server.ts` to `@templjs/language-server`.

## Tasks

- [x] Add package scaffolding and build/test wiring for the three new packages.
- [x] Introduce `createTempljsLanguagePlugins(options)` entrypoint in `@templjs/language-core`.
- [x] Introduce `createTempljsServicePlugins(options)` entrypoint in `@templjs/language-service`.
- [x] Introduce `startTempljsLanguageServer(options)` and CLI entrypoint in `@templjs/language-server`.
- [x] Reduce VS Code package implementation to thin forwarding shims while preserving behavior.

## Acceptance Criteria

- [x] VS Code extension starts server through `@templjs/language-server` entrypoint.
- [x] Service plugin creation no longer lives under `src/extensions/vscode/src/**`.
- [x] New package tests/builds pass and extension integration remains green.

## Relationships

- `depends_on`: [[work-item-098-language-core-contracts-and-boundary-tests]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
