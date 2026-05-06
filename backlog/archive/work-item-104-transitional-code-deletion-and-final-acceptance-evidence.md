---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:104-transitional-code-deletion-and-final-acceptance-evidence
title: '104: Delete transitional code and finalize architecture acceptance evidence'
summary: Remove superseded transitional modules, complete Volar Labs validation evidence, and close the migration epic with unified test coverage
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 7
actual: 2
completed_date: '2026-05-06'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/75
  evidence:
    - '[[record-104-transitional-code-deletion-and-final-acceptance-evidence-1]]'
---

## Goal

Deliver Stage 7 of [docs/templjs-volar-target-architecture.md](docs/templjs-volar-target-architecture.md) by deleting superseded code paths and collecting final acceptance evidence.

## Scope

- Remove root-only host virtual code path and superseded mapping utilities.
- Remove VS Code-local schema semantic resolution and broad scanner fallbacks after cutover.
- Capture final Volar Labs and suite evidence for architecture completion.

## Tasks

- [x] Delete superseded root-only virtual code and duplicated mapping helpers.
- [x] Delete VS Code-local semantic schema/loading logic no longer needed post-cutover.
- [x] Delete broad Volar-local semantic scanners replaced by core/context-graph flows.
- [x] Update ADR references, package READMEs, and migration docs to final architecture state.
- [x] Produce final evidence records including Volar Labs inspection notes.

## Acceptance Criteria

- [x] Target architecture validation commands and required scenarios all pass.
- [x] No transitional semantic ownership remains in VS Code package code.
- [x] Migration epic can move to `ready-for-review` with linked evidence records.

## Relationships

- `depends_on`: [[work-item-103-vscode-client-thinning-and-wrapper-removal]]
- `depends_on`: [[work-item-097-volar-target-architecture-migration-epic]]
