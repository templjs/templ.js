---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:123-trim-and-verify-vsix-package-file-set
title: '123: Trim and Verify VSIX Package File Set'
summary: Verify the VSIX production package file list and exclude unintended smoke or tooling files.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 3
actual: 0
completed_date: '2026-05-18'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/152
  evidence:
    - '[[record-20260516-123-trim-and-verify-vsix-package-file-set]]'
---

## Goal

Make the VS Code extension VSIX file set intentional for the RC.

## Background

`vsce package --no-dependencies` succeeds, but the package list includes smoke and Playwright configuration files that are useful for repository validation and not necessarily part of the production extension artifact.

## Tasks

- [x] Inspect `pnpm exec vsce ls --no-dependencies` output.
- [x] Decide the production VSIX allowlist/ignore behavior for smoke and tooling files.
- [x] Update package ignore configuration or packaging inputs without removing source tests from the repo.
- [x] Verify prerelease VSIX package generation after trimming.

## Deliverables

- Updated VSIX package file inclusion/exclusion configuration if needed.
- Captured package file list evidence.
- Prerelease VSIX dry-run artifact.

## Acceptance Criteria

- [x] VSIX package contents are intentional and exclude unrelated smoke/tooling files when appropriate.
- [x] Runtime assets, syntaxes, bundled extension output, and required metadata remain packaged.
- [x] `pnpm exec vsce package --no-dependencies --pre-release --out /private/tmp/templjs-rc-pre-release.vsix` succeeds.

## Relationships

- `part_of`: [[work-item-124-first-release-candidate-execution-and-evidence]]
- `depends_on`: [[work-item-120-normalize-vscode-extension-package-identity-and-changesets]]
