---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:120-normalize-vscode-extension-package-identity-and-changesets
title: '120: Normalize VS Code Extension Package Identity and Changesets'
summary: Align the VS Code extension workspace package name with documented release identity and normalize pending Changesets.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 4
actual: 0
completed_date: '2026-05-18'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/152
  evidence:
    - '[[record-20260516-120-normalize-vscode-extension-package-identity-and-changesets]]'
---

## Goal

Normalize the VS Code extension package identity to `vscode-templjs` and make Changesets status checks work for the release train.

## Background

Repository instructions and ADR-004 identify the VS Code extension as `vscode-templjs`, but the extension package currently uses a different package name. Pending Changesets are inconsistent, which blocks `pnpm changeset status --verbose` and therefore stable release readiness.

## Tasks

- [x] Rename the VS Code extension workspace package identity to `vscode-templjs`.
- [x] Normalize pending `.changeset/*.md` package entries so extension changes target `vscode-templjs`.
- [x] Keep VSIX output names explicit in release scripts or workflows where stable artifact names matter.
- [x] Verify workspace filters and release commands still find the extension package.
- [x] Verify `pnpm changeset status --verbose` succeeds.

## Deliverables

- Updated extension package identity.
- Normalized pending Changesets.
- Release script or workflow updates preserving expected VSIX artifact naming.
- Changeset status validation evidence.

## Acceptance Criteria

- [x] `pnpm changeset status --verbose` succeeds without unknown package errors.
- [x] `pnpm --filter vscode-templjs build` resolves the extension workspace.
- [x] VSIX artifact names are deterministic and documented by command or workflow output.
- [x] No package versions are manually edited.
