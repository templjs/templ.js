---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:100-root-and-embedded-virtual-code-model-cutover
title: '100: Replace root-only virtual code with root + embedded model'
summary: Implement TemplJS root virtual code and explicit host, DSL, semantic, and frontmatter embedded virtual documents with source maps
type: work-item
subtype: task
lifecycle: active
status: ready
priority: high
estimated: 14
actual: 0
---

## Goal

Deliver Stage 3 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by replacing root-as-host virtual code with explicit embedded virtual documents.

## Scope

- Introduce root `TempljsVirtualCode` with identity source mapping and metadata.
- Generate `host.<language>`, `templjs.dsl`, `frontmatter.*`, and optional semantic TS virtual documents.
- Implement parse-once snapshot update flow and mapping regeneration.

## Tasks

- [ ] Implement root metadata model and embedded virtual code tree contracts.
- [ ] Implement host embedded document masking with source-preserving mappings.
- [ ] Implement DSL embedded document generation for statements and expressions.
- [ ] Implement frontmatter embedded document generation and exact range mappings.
- [ ] Add multiline/custom-delimiter/generated-to-source round-trip tests.
- [ ] Record Volar Labs inspection evidence for representative templates.

## Acceptance Criteria

- [ ] Volar Labs shows root + embedded documents for supported host formats.
- [ ] Host diagnostics map to source ranges correctly.
- [ ] Template semantic diagnostics map to template spans (not placeholder spans).
- [ ] Mapping suites pass for default and custom delimiters.

## Relationships

- `depends_on`: [[work-item-099-language-package-split-and-entrypoint-migration]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
