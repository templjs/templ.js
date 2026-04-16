---
$schema: schemas/work-management/frontmatter/record.json
id: record:058-context-graph-volar-adapter-and-semantic-reads-evidence-5
title: '058: Add Volar adapter and migrate semantic reads evidence 5'
summary: '058: Add Volar adapter and migrate semantic reads evidence 5'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.763Z

## Outcome

noted

## Observation

Performance and YAML-frontmatter follow-up (8ab845c, e87096e):

- Snapshot cache keys now prefer object-identity tokens over full schema serialization
- Shared scope matching and default-filter caching reduce repeated semantic helper allocations
- Frontmatter context detection now avoids false nested scopes for YAML block scalars, flow collections, anchors, and aliases
- Focused verification:
  - `pnpm --filter @templjs/volar test -- test/intellisense-provider.test.ts` (67 passed)
  - `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)

## Subject References

- [[work-item-058-context-graph-volar-adapter-and-semantic-reads]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/27>
