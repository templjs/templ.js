---
$schema: schemas/work-management/frontmatter/record.json
id: record:107-esm-server-bundle-spike-evidence-1
title: '107: ESM server bundle spike evidence and migration checkpoints'
summary: Captures WI-107 ESM server spike outcomes, runtime blockers, implemented mitigations, and validation results for the opt-in server module format path
type: record
subtype: evidence
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-05-13T17:29:46Z

## Outcome

passed

## Observation

### Spike Reproduction and Blockers

- Switching the server bundle format to ESM reproduces a runtime startup failure under current CJS-oriented assumptions.
- The initial ESM smoke run failed with `Dynamic require of "node:util" is not supported` from `dist/server.mjs`.
- The extension startup path also requires launch-contract parity for the server module (module file selection and debug/run module path handling).

### Implemented Mitigations (Rollback-Safe)

- Added a controlled server format selector in `src/extensions/vscode/scripts/build.mjs` using `TEMPLJS_SERVER_FORMAT` with default `cjs`.
- Kept CJS as the release-safe default output and added an opt-in ESM server output at `dist/server.mjs`.
- Injected an ESM-safe `require` shim via `createRequire(import.meta.url)` banner so bundled CJS dependencies using dynamic `require()` can execute under ESM output.
- Added extension runtime configuration `templjs.serverModuleFormat` and server module selection in `src/extensions/vscode/src/extension.ts`.
- Kept bundled dependency validation compatible with both formats in `src/extensions/vscode/scripts/validate-bundled-deps.mjs`.

### Validation Evidence

- `rtk pnpm --dir src/extensions/vscode run test -- test/bundle-sanity.test.ts test/extension.test.ts test/server-main.test.ts`
  - passed (130 tests), including ESM opt-in startup regression coverage.
- `rtk pnpm --dir src/extensions/vscode run build`
  - passed; both bundling and bundled dependency validation succeed.

### Phased Migration Checkpoints

1. **Phase 1 (completed in WI-107):** Opt-in ESM server prototype with CJS default retained.
2. **Phase 2 (next):** Stabilize launch/debug parity and broaden extension-host startup smoke coverage.
3. **Phase 3 (later):** Promote ESM server output to default only after packaging and startup matrix remains green.

## Subject References

- [[work-item-107-esm-server-bundle-spike-and-migration-plan]]

## Artifact References

- [Build script](../..//src/extensions/vscode/scripts/build.mjs)
- [Extension launcher](../..//src/extensions/vscode/src/extension.ts)
- [Bundle validation script](../..//src/extensions/vscode/scripts/validate-bundled-deps.mjs)
