---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:129-templjs-template-and-schema-profile-integration
title: '129: TemplJS Template and Schema Profile Integration'
summary: Add TemplJS template/schema adapters and profile rules so existing authoring semantics flow through Semantify projection.
type: work-item
subtype: task
lifecycle: active
status: ready-for-review
status_reason: implementation-complete
priority: high
estimated: 8
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/156
  evidence:
    - '[[record-20260520-129-templjs-template-and-schema-profile-integration]]'
---

## Goal

Integrate TemplJS template and schema semantics into the projection architecture through adapters and profile rules, preserving existing authoring behavior while moving reusable semantic construction out of Volar-specific code.

## Background

Current schema path graph construction and query behavior live in Volar's context-graph adapter and snapshot helpers. Template binding and expression semantics flow through Core and Semantify helpers, but not yet through normalized adapter output and profile projection.

## Tasks

- [x] Define a TemplJS template adapter over `@templjs/core` parse, binding, expression, and semantic-zone facts.
- [x] Define a schema adapter over shared schema metadata and schema source information.
- [x] Define a TemplJS authoring profile with semantic kinds and projection rules for template bindings, schema paths, enum values, zones, and references.
- [x] Move reusable schema graph construction out of Volar-specific modules into adapter/profile projection paths.
- [x] Preserve current custom delimiter, frontmatter/content, local alias, and schema path behavior.
- [x] Add integration tests comparing old authoring behavior to projected graph output.

## Progress Notes

- 2026-05-20: Added `createTempljsTemplateAdapterOutput`, `createTempljsSchemaAdapterOutput`, and `createTempljsAuthoringProfile`.
- 2026-05-20: Added tests proving template bindings, schema paths, enum values, and helper metadata project through the authoring profile.
- 2026-05-20: Merged via PR #156 to `staging`; compatibility tests cover delimiter, frontmatter/content, alias, and schema-path parity scenarios.

## Deliverables

- TemplJS template and schema adapter contracts/implementations.
- TemplJS authoring profile with projection rules.
- Compatibility tests for schema completions, hover, definition, diagnostics inputs, aliases, and zones.

## Acceptance Criteria

- [x] TemplJS adapters emit normalized adapter output with source spans and metadata.
- [x] The TemplJS profile projects existing template/schema semantics into graph output with provenance.
- [x] Volar-specific schema graph construction is no longer the canonical reusable semantic path.
- [x] Existing authoring behavior remains covered by package integration tests.

## Relationships

- `depends_on`: [[work-item-128-semantify-projection-runtime-and-dsl-foundation]]
- `related`: [[work-item-070-adopt-shared-schema-analysis-in-volar]]
- `related`: [[work-item-085-structured-expression-parser-ast-migration-epic]]
