---
$schema: schemas/work-management/frontmatter/record.json
id: record:060-context-graph-hover-definition-exclusive-cutover-evidence-3
title: '060: Enforce exclusive context-graph hover/definition resolution evidence 3'
summary: '060: Enforce exclusive context-graph hover/definition resolution evidence 3'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.694Z

## Outcome

noted

## Observation

Schema-resolution and cache follow-up (8ab845c):

- Server-side schema loading now uses async file existence checks while sync definition lookups keep a dedicated sync resolver
- Snapshot cache keys now prefer object-identity tokens over full schema serialization
- Shared scope matching and default-filter caching reduce repeated semantic helper work during hover/definition reads
- Focused verification:
  - `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)
  - `pnpm --filter vscode-templjs test -- test/server.test.ts` (32 passed)

## Subject References

- [[work-item-060-context-graph-hover-definition-exclusive-cutover]]
