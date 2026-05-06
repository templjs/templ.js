---
$schema: schemas/work-management/frontmatter/record.json
id: record:100-root-and-embedded-virtual-code-model-cutover-evidence-1
title: '100: Root and embedded virtual code model cutover evidence'
summary: Stage 3 virtual code model now publishes explicit embedded host, DSL, and frontmatter documents with passing volar and extension suites
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Implementation Summary

Completed Stage 3 cutover work by publishing explicit embedded virtual documents from root virtual code and adding direct test coverage for host, DSL, and frontmatter embedded outputs.

## Delivered

- Added explicit embedded virtual code generation in `@templjs/volar` root virtual code:
  - `host.<language>` embedded virtual document
  - `templjs.dsl` embedded virtual document
  - `frontmatter.yaml` / `frontmatter.json` embedded virtual document when detected
- Preserved update and mapping stability across incremental edits.
- Added new `@templjs/volar` tests that assert embedded document presence and frontmatter mapping behavior.

## Validation Commands

- `rtk pnpm --filter @templjs/volar test`
- `rtk pnpm --dir src/extensions/vscode run test`

All commands completed successfully.
