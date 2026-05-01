---
$schema: schemas/work-management/frontmatter/record.json
id: record:098-language-core-contracts-and-boundary-tests-evidence-1
title: '098: Language-core contracts and boundary test evidence'
summary: Added @templjs/language-core package-owned contracts, boundary tests, and stage-1 validation runs
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Implementation Summary

Implemented Stage 1 contract scaffolding in `@templjs/language-core` with package-owned types and boundary tests that avoid third-party type leakage.

## Validation

- `rtk pnpm --filter @templjs/language-core build`
- `rtk pnpm --filter @templjs/language-core test`
- `rtk pnpm run type-check`

All commands completed successfully.

## Files Added

- `src/packages/language-core/package.json`
- `src/packages/language-core/tsconfig.json`
- `src/packages/language-core/vitest.config.ts`
- `src/packages/language-core/README.md`
- `src/packages/language-core/src/public-types.ts`
- `src/packages/language-core/src/index.ts`
- `src/packages/language-core/test/contracts-boundary.test.ts`

## Files Updated

- `tsconfig.json` (added language-core project reference)
