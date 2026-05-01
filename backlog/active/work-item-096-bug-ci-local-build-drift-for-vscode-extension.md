---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:096-bug-ci-local-build-drift-for-vscode-extension
title: '096: CI/local build drift for VS Code extension package'
summary: Required CI checks can pass while local extension package build fails with TS6305 and strict type errors, obscuring real release risk
type: work-item
subtype: bug
lifecycle: active
status: ready-for-review
priority: high
estimated: 3
actual: 3
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/65
  evidence:
    - '[[record-096-bug-ci-local-build-drift-for-vscode-extension-evidence-1]]'
---

## Goal

Eliminate build drift between CI merge gates and local/package-specific extension builds so a green PR reliably implies the VS Code extension build path is healthy.

## Background

A merged PR passed all required `staging` ruleset checks, including `Build`, but local `pnpm --dir src/extensions/vscode run build` still failed. Current evidence shows:

1. Merge rules are satisfied by named CI contexts, not by every local build invocation.
2. CI `Build` runs `pnpm run ci:build` (`nx affected -t build --base=origin/main`), which may not exercise the same package build path as local extension-only commands in all scenarios.
3. Local toolchain/state differences (for example unsupported Node runtime and stale/missing dist declarations) can produce TS6305 and strict typing failures not reproduced in CI.

This mismatch causes confusion during PR validation and weakens confidence in release readiness.

## Bug Summary

The repository currently allows a successful merge signal while developers can still see extension package build failures locally. Even when this is partly environmental, the workflow does not make the expected parity boundaries explicit enough, and may not guarantee extension-package-specific build parity in the required check set.

## Reproduction Steps

1. Check out the PR head branch that passed required checks.
2. Run the extension package build directly: `pnpm --dir src/extensions/vscode run build`.
3. Observe build failures (for example TS6305 and implicit-any errors) under certain local states/toolchains.
4. Compare with PR check status showing required contexts succeeded.

## Expected Behavior

A merged PR should correspond to a clearly documented and reproducible build contract:

1. Either local package build parity is guaranteed by required checks, or
2. the workflow/tooling explicitly enforces and validates the supported local environment before claiming parity.

## Actual Behavior

Required checks can be green while local extension package build still fails, creating uncertainty about whether failures are environmental noise or real release risk.

## Scope

- Confirm exact parity contract between required checks and local extension package build paths.
- Determine whether required checks need to include an explicit extension package build target.
- Add guardrails/documentation so local unsupported environments fail fast with actionable guidance.

## Tasks

- [x] Audit required check contexts against expected local developer build commands.
- [x] Classify failure modes: environment-only vs reproducible code/config drift.
- [x] Decide and implement parity policy (workflow update and/or local preflight guard).
- [x] Add regression coverage or validation scripts that catch this drift class early.
- [x] Update contributor docs with definitive local/CI build parity guidance.

## Deliverables

- [x] A documented build parity contract for CI vs local workflows.
- [x] Workflow and/or script changes that enforce the chosen parity policy.
- [x] Tests or validation evidence proving drift is detected before merge.

## Acceptance Criteria

- [x] The same commit that passes required CI checks also passes the defined local extension build contract under supported toolchains.
- [x] Unsupported local environments fail with clear, actionable guidance.
- [x] Documentation clearly states which commands are merge-gating and which are advisory.
- [x] A regression check exists to prevent future CI/local drift for extension builds.

## Relationships

- `relates_to`: [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Links

- `evidence`: [[record-096-bug-ci-local-build-drift-for-vscode-extension-evidence-1]]
