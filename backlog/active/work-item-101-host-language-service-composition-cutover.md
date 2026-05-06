---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:101-host-language-service-composition-cutover
title: '101: Move host-language services into language-server composition'
summary: Register host language diagnostics/authoring services in language-service/server composition and remove VS Code-local ownership
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
priority: high
estimated: 8
actual: 3
links:
  evidence:
    - '[[record-101-host-language-service-composition-cutover-evidence-1]]'
---

## Goal

Deliver Stage 4 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by moving host-language service composition out of VS Code package code.

## Scope

- Register host services in `@templjs/language-service` / `@templjs/language-server` composition.
- Route frontmatter YAML/JSON validation through frontmatter embedded documents.
- Remove VS Code-specific service composition responsibilities.

## Tasks

- [x] Move service registration ownership to language-service/server packages.
- [x] Route markdown/json/yaml/html diagnostics through host embedded documents.
- [x] Replace local YAML diagnostics with host-service-backed frontmatter validation.
- [x] Reduce `src/extensions/vscode/src/service-plugins.ts` to compatibility shim or delete it.

## Acceptance Criteria

- [x] Host service registration is visible in `@templjs/language-server` composition.
- [x] VS Code package no longer owns semantic host diagnostic routing logic.
- [x] Integration tests prove host diagnostics map through virtual document mappings.

## Relationships

- `depends_on`: [[work-item-100-root-and-embedded-virtual-code-model-cutover]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
