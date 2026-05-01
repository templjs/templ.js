---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:098-language-core-contracts-and-boundary-tests
title: '098: Establish language-core contracts and boundary tests'
summary: Define package-owned architecture contracts and enforce no third-party type leakage at public boundaries
type: work-item
subtype: task
lifecycle: active
status: ready
priority: high
estimated: 5
actual: 0
---

## Goal

Deliver Stage 1 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by establishing package-owned contract types and API-boundary tests before behavior migration begins.

## Scope

- Define package-owned interfaces for source kind, host language, generated-code purpose, virtual metadata, semantic zone refs, schema source refs, snapshot ids, and server init options.
- Add contract tests that fail on third-party type leakage in public `.d.ts` surfaces.
- Keep this stage behavior-neutral.

## Tasks

- [ ] Add `TempljsSourceFileKind`, `TempljsHostLanguage`, and `TempljsGeneratedCodePurpose` contracts.
- [ ] Add `TempljsVirtualDocumentMetadata`, `TempljsSemanticZoneRef`, and `TempljsSchemaSourceRef` contracts.
- [ ] Add `TempljsDocumentSnapshotId` and `TempljsLanguageServerInitializationOptions` contracts.
- [ ] Add boundary tests proving JSON-compatible public payloads and no Volar/VS Code/TypeScript type leakage.
- [ ] Add package README notes documenting server/client boundary expectations.

## Acceptance Criteria

- [ ] Contracts compile independently of `src/extensions/vscode/**`.
- [ ] Public API boundary tests fail on third-party type leakage.
- [ ] No source behavior changes are introduced.
- [ ] Targeted package tests and repo type-check pass.

## Relationships

- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
- `relates_to`: [[work-item-056-context-graph-platform-epic]]
