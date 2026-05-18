---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:119-fix-vscode-extension-lint-script-nx-forwarded-args
title: '119: Fix VS Code Extension Lint Script for Nx Forwarded Args'
summary: Make the VS Code extension lint script tolerate Nx-forwarded arguments so root CI linting can complete.
type: work-item
subtype: bug
lifecycle: active
status: ready-for-review
status_reason: awaiting-review
priority: high
estimated: 2
actual: 0
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/152
  evidence:
    - '[[record-20260516-119-fix-vscode-extension-lint-script-nx-forwarded-args]]'
---

## Goal

Fix the VS Code extension lint command so `pnpm run lint:ci` can run through Nx without failing on forwarded arguments.

## Background

The current extension lint script exits through a shell command that receives Nx forwarded arguments, which causes `exit: too many arguments` during root CI lint execution. This blocks the RC validation matrix even though no extension linting is configured yet.

## Tasks

- [x] Replace the shell `echo ... && exit 0` lint script with an argument-tolerant no-op or real lint command.
- [x] Verify the extension lint target directly with forwarded arguments.
- [x] Verify root `pnpm run lint:ci` reaches the next validation phase without the extension script failure.
- [x] Add a Changeset entry if the package-facing extension metadata changes.

## Deliverables

- Updated extension lint script.
- Validation evidence for direct and root lint execution.
- Changeset if required by package release policy.

## Acceptance Criteria

- [x] `pnpm --filter vscode-templjs lint -- --outputStyle=static` exits successfully after package identity normalization.
- [x] `pnpm run lint:ci` no longer fails because of the VS Code extension lint script.
- [x] The fix does not introduce an unrelated linting framework or release workflow change.

## Relationships

- `part_of`: [[work-item-124-first-release-candidate-execution-and-evidence]]
- `depends_on`: [[work-item-120-normalize-vscode-extension-package-identity-and-changesets]]
