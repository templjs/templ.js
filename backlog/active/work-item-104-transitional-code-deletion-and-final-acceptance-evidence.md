---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:104-transitional-code-deletion-and-final-acceptance-evidence
title: '104: Delete transitional code and finalize architecture acceptance evidence'
summary: Remove superseded transitional modules, complete Volar Labs validation evidence, and close the migration epic with unified test coverage
type: work-item
subtype: task
lifecycle: active
status: ready
priority: high
estimated: 7
actual: 0
---

## Goal

Deliver Stage 7 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by deleting superseded code paths and collecting final acceptance evidence.

## Scope

- Remove root-only host virtual code path and superseded mapping utilities.
- Remove VS Code-local schema semantic resolution and broad scanner fallbacks after cutover.
- Capture final Volar Labs and suite evidence for architecture completion.

## Tasks

- [ ] Delete superseded root-only virtual code and duplicated mapping helpers.
- [ ] Delete VS Code-local semantic schema/loading logic no longer needed post-cutover.
- [ ] Delete broad Volar-local semantic scanners replaced by core/context-graph flows.
- [ ] Update ADR references, package READMEs, and migration docs to final architecture state.
- [ ] Produce final evidence records including Volar Labs inspection notes.

## Acceptance Criteria

- [ ] Target architecture validation commands and required scenarios all pass.
- [ ] No transitional semantic ownership remains in VS Code package code.
- [ ] Migration epic can move to `ready-for-review` with linked evidence records.

## Relationships

- `depends_on`: [[work-item-103-vscode-client-thinning-and-wrapper-removal]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
