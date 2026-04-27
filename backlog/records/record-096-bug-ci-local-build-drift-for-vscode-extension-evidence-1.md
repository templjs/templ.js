---
$schema: schemas/work-management/frontmatter/record.json
id: record:096-bug-ci-local-build-drift-for-vscode-extension-evidence-1
title: '096: CI/local build drift resolution — build parity verification'
summary: Local extension build and affected build both pass after fixing TS6305 drift, strict typing errors, and missing bundler dependency
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-26T00:00:00.000Z

## Outcome

passed

## Observation

### Root Cause Classification

Two drift categories were identified and resolved:

1. **Reproducible code/config drift** — `tsc -b` on dependent packages (cli, volar, extension) silently used
   stale declaration files from `dist/` instead of forcing a fresh reference build. Switching to
   `tsc -b --force` in each package's build script eliminated TS6305 "Output file has not been built
   from source file" errors reproducibly.

2. **Strict typing drift** — Implicit-any callback parameters in five volar/extension source files
   (`context-graph-adapter.ts`, `expression-analysis.ts`, `intellisense-provider.ts`,
   `scope-resolution.ts`, `service-plugins.ts`) passed CI but failed under stricter local tsconfig
   state. Explicit parameter types were added to each.

3. **Missing bundler dependency** — `build.mjs` (extension esbuild bundler) required
   `vscode-json-languageservice` at bundle time but it was absent from devDependencies. Added.

### Guardrails Added

- `scripts/ci/verify-toolchain.ts`: fail-fast Node/pnpm version check wired as first pre-push task.
  Blocks push on unsupported runtimes (Node v25 blocked; Node 22 or 24 required) with actionable
  remediation: `nvm install 24 && nvm use 24`.
- `hook-runner.ts` pre-push sequence: `ci:toolchain → lint:frontmatter → lint:eslint:pre-push →
test:affected:pre-push → build:affected:pre-push → type-check`
- `DEVELOPMENT.md` updated with Pre-Push Build Parity section documenting the 6-step flow,
  merge-gating vs advisory commands, and Node constraint.

### Build Verification

Extension-only build (direct package command):

```text
pnpm --dir src/extensions/vscode run build
→ extension.js  791.6 kb
→ server.js     4.5 mb
→ Exit 0
```

Affected local build (all 5 projects):

```text
pnpm run build:affected:local
→ @templjs/core           ✓
→ @templjs/context-graph  ✓
→ @templjs/cli            ✓
→ @templjs/volar          ✓
→ vscode-templjs          ✓
→ Exit 0
```

### Commits

- `af13805116787f515f6fd199c0597c30bc69c6ec` — fix(build): resolve CI/local drift for VS Code extension package (WI-096)
- `d7f961dff7ec432158d2ef85cfc93993f446f3c6` — feat(work-item): add bug for CI/local build drift issue in VS Code extension
