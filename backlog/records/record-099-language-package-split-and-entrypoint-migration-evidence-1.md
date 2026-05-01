---
$schema: schemas/work-management/frontmatter/record.json
id: record:099-language-package-split-and-entrypoint-migration-evidence-1
title: '099: Language package split and entrypoint migration evidence'
summary: Stage 2 migration completed with language-service and language-server ownership plus thin VS Code wrappers
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Implementation Summary

Completed Stage 2 package split by introducing reusable package entrypoints and reducing VS Code source modules to forwarding shims.

## Delivered

- Added `@templjs/language-service` package with service plugin and schema-loading ownership.
- Added `@templjs/language-server` package with server startup and reusable entrypoint.
- Added `createTempljsLanguagePlugins(options)` to `@templjs/language-core`.
- Converted VS Code modules to wrappers:
  - `src/extensions/vscode/src/server.ts`
  - `src/extensions/vscode/src/service-plugins.ts`
  - `src/extensions/vscode/src/schema-loading.ts`

## Validation Commands

- `rtk pnpm --filter @templjs/language-core test`
- `rtk pnpm --filter @templjs/language-service build`
- `rtk pnpm --filter @templjs/language-server build`
- `rtk pnpm --dir src/extensions/vscode run test -- test/server.test.ts test/server-inprocess.integration.test.ts`
- `rtk pnpm run type-check`
- `rtk pnpm --dir src/extensions/vscode run build`

All commands completed successfully.
