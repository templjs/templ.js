---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:045-cli-remove-dead-streaming-json-code
title: '45: Remove Dead Streaming JSON Code from readPayload'
summary: Remove Dead Streaming JSON Code from readPayload
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: obsolete
priority: low
estimated: 1
actual: 0
commits:
  8900fcc: 'fix(pr-23): resolve latest review round with targeted regressions'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-045-cli-remove-dead-streaming-json-code-evidence-1]]'
---

## Goal

Remove unreachable streaming JSON parsing code from `readPayload()` to simplify control flow and avoid confusion.

## Background

PR 23 unresolved comment: The `readPayload()` large-file branch contains a `streamJsonEnabled() && resolveInputFormat(...) === 'json'` path that parses via `parseJsonObjectStream()` then `JSON.stringify()`s it. This appears unreachable because `parseData()` routes to `parseDataStream()` whenever `streamJsonEnabled()` is true for JSON inputs.

## Tasks

- [x] Verify the streaming JSON path in `readPayload()` is truly unreachable
- [x] Remove dead code or wire it consistently with `validateInput` handling
- [x] Add integration test confirming streaming JSON path works correctly
- [x] Update comments to clarify which path handles streaming JSON

## Acceptance Criteria

- [x] Dead code removed OR properly wired and tested
- [x] No unreachable streaming JSON parsing code remains
- [x] All render command tests pass
- [x] Code coverage maintained or improved

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901552562)

Location: `src/packages/cli/src/commands/render.ts` around lines 167-173

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
