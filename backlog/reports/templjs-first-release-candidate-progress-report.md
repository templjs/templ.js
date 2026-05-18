---
id: rpt-002
type: document
subtype: report
lifecycle: active
status: ready
title: 'templjs First Release Candidate Progress Report'
description: >
  Milestone-oriented RC execution evidence for WI-124 covering release blockers,
  shared-schema rollout validation, architecture/parser scope validation, and full
  Node 24 matrix status.
---

**Date**: May 18, 2026
**Plan**: `backlog/plans/templjs-first-release-candidate-implementation-plan.md`
**Primary Tracker**: `backlog/archive/work-item-124-first-release-candidate-execution-and-evidence.md`

## Milestone 1: Immediate Deliverables

- Verified `WI-119` through `WI-124` already exist in `backlog/active/`.
- Verified RC implementation plan file exists at `backlog/plans/templjs-first-release-candidate-implementation-plan.md`.
- Frontmatter validation:
  - `fnm exec --using 24 pnpm run lint:frontmatter` -> pass.

## Milestone 2: Release Blockers (WI-120 -> WI-119 -> WI-121 -> WI-122 -> WI-123)

Evidence-driven status after Node 24 validation:

- `WI-120` package identity and changeset normalization checks passed:
  - extension package name is `vscode-templjs`
  - `fnm exec --using 24 pnpm changeset status --verbose` -> pass
- `WI-119` lint forwarded-arg behavior passed:
  - `fnm exec --using 24 pnpm --filter vscode-templjs lint -- --outputStyle=static` -> pass
  - `fnm exec --using 24 pnpm run lint:ci` -> pass
- `WI-121` public package inventory and publish surface validated via dry-run pack checks:
  - `@templjs/core`
  - `@templjs/cli`
  - `@templjs/volar`
  - `@templjs/context-graph`
  - `@templjs/language-core`
  - `@templjs/language-service`
  - `@templjs/language-server`
  - `@templjs/semantify`
- `WI-122` semantify release model docs/guidance confirmed present in:
  - `docs/release-process.md`
  - root `AGENTS.md`
- `WI-123` VSIX file-set and package dry-run checks passed:
  - `fnm exec --using 24 pnpm --dir src/extensions/vscode exec vsce ls --no-dependencies`
  - `fnm exec --using 24 pnpm --dir src/extensions/vscode exec vsce package --no-dependencies --pre-release --out /private/tmp/templjs-rc-pre-release.vsix`

## Milestone 3: Shared-Schema Rollout

Validation of shared-schema lane and affected surfaces passed through full repo build/test/type/lint on Node 24:

- `fnm exec --using 24 pnpm run lint:ci` -> pass
- `fnm exec --using 24 pnpm run type-check` -> pass
- `fnm exec --using 24 pnpm run build` -> pass
- `fnm exec --using 24 pnpm run test` -> pass

No new shared-schema blockers observed during this pass.

## Milestone 4: Architecture and Parser Scope

Architecture/parser lane sanity was covered by the same full matrix (build/test/type/lint) and package dry-runs:

- No failing checks observed in context-graph, volar, language-service, language-server, or core parser surfaces.
- No new parser/filter RC blockers detected from this execution pass.

## Milestone 5: Full Validation Matrix

Executed on Node 24:

- `fnm exec --using 24 pnpm run ci:toolchain` -> pass
- `fnm exec --using 24 pnpm run lint:frontmatter` -> pass
- `fnm exec --using 24 pnpm run lint:ci` -> pass
- `fnm exec --using 24 pnpm run type-check` -> pass
- `fnm exec --using 24 pnpm run test` -> pass
- `fnm exec --using 24 pnpm run build` -> pass
- `fnm exec --using 24 pnpm run ci:docs-api` -> pass
- `fnm exec --using 24 pnpm run benchmark:ci` -> pass
- `fnm exec --using 24 pnpm run benchmark:summary` -> pass
- `fnm exec --using 24 pnpm changeset status --verbose` -> pass
- `fnm exec --using 24 pnpm --dir src/extensions/vscode exec vsce ls --no-dependencies` -> pass
- `fnm exec --using 24 pnpm --dir src/extensions/vscode exec vsce package --no-dependencies --pre-release --out /private/tmp/templjs-rc-pre-release.vsix` -> pass

Additional package evidence (all pass): `npm pack --dry-run` for each public package listed under Milestone 2.

## Milestone 6: Optional Nice-to-Have Evaluation

- Completed optional-lane evaluation for `WI-047` through `WI-052`.
- Current disposition:
  - `WI-047` (`Template Extraction Framework`) remains `proposed`.
  - `WI-048` through `WI-052` remain `proposed` and are linked to earlier exploratory PR references (`#42`, `#43`) rather than RC-ready merged scope.
- Validation signal used for go/no-go:
  - Required RC matrix remains green on Node 24 (Milestone 5 pass set).
  - No new blocker was discovered that requires executing optional extraction scope in the RC lane.
- Decision:
  - Keep `WI-047` through `WI-052` deferred from the first RC publication lane.
  - Preserve them as follow-up scope after RC publication stability is confirmed.
- Failing validations in Milestone 6: none.
- Files changed in Milestone 6: this report only.
- Next lane to execute: Milestone 7 backlog-automation handoff preparation.

## Milestone 7: Backlog Automation Handoff

- Manual work-item closure and archive movement were not performed.
- RC evidence is captured here for `backlog-automation` to consume for final evidence normalization, closure confirmation, and archival workflows.

## Files Changed in This Report Pass

- `backlog/reports/templjs-first-release-candidate-progress-report.md`

## Outstanding Notes

- Root working tree contains an untracked local artifact: `pr150.diff`.
- Archived RC blocker work items had dependency edges normalized to keep `lint:frontmatter` green while preserving backlog-automation ownership for final closure/archive workflows.
- No destructive operations were used.
- No package versions were edited manually.
