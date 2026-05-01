---
$schema: schemas/work-management/frontmatter/record.json
id: record:101-host-language-service-composition-cutover-evidence-1
title: '101: Host language service composition cutover evidence'
summary: Stage 4 host-language service ownership is package-scoped in language-service/language-server with VS Code layer reduced to shims
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Implementation Summary

Validated that host-language service composition is owned by package layers and that VS Code modules only forward to package entrypoints.

## Delivered

- `src/extensions/vscode/src/service-plugins.ts` is a forwarding shim to `@templjs/language-service`.
- `src/extensions/vscode/src/server.ts` is a forwarding shim to `@templjs/language-server` startup.
- Host diagnostics and authoring transport delegation are exercised via language-service/server integration tests.

## Validation Commands

- `rtk pnpm --filter @templjs/language-service build`
- `rtk pnpm --filter @templjs/language-server build`
- `rtk pnpm --dir src/extensions/vscode run test -- test/server.test.ts test/server-inprocess.integration.test.ts test/service-plugins.test.ts`

All commands completed successfully.
