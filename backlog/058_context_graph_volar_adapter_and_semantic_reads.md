---
id: wi-058
type: work-item
subtype: task
lifecycle: active
title: '058: Add Volar adapter and migrate semantic reads'
status: ready-for-review
priority: high
estimated: 10
actual: 10
assignee: ''
commits:
  91d942c: 'feat(volar): integrate context graph into semantic reads'
  cb3f6a0: 'feat(context-graph): complete graph-backed semantic resolution'
  1b9ff47: 'test(volar): remove debug logging and de-instrument memoization test'
  8ab845c: 'perf(ide): optimize schema resolution and semantic caches'
  e87096e: 'fix(volar): avoid false YAML frontmatter scopes'
  62b21a2: 'test(core): raise semantic coverage'
  c0bb1c5: 'test(volar): add coverage utility suites'
test_results:
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      WI-058 implementation verification:
      - Added core-backed semantic scope extraction API (`extractTemplateScopeBindings`) and tests
      - Added Volar context-graph semantic read adapter with profile-aware schema/query reads
      - Routed completion, hover, and definition semantic path reads through graph adapter with fallback preservation
      - Added regression tests for nested scope shadowing and mixed frontmatter/content semantic reads
      - Focused tests: 90 passed, 0 failed
      - Package builds: `pnpm --filter @templjs/core build`, `pnpm --filter @templjs/context-graph build`, `pnpm --filter @templjs/volar build` passed
      - Workspace build: `pnpm build` passed (5 projects)
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Architecture boundary correction follow-up:
      - Repointed Volar semantic-context usage to `@templjs/core` (`resolveSemanticContextBlock` + frontmatter alias helpers)
      - Kept `@templjs/context-graph` usage in Volar limited to generic graph contracts
      - Focused verification after correction: 129 passed, 0 failed
      - Builds reconfirmed: `pnpm --filter @templjs/core build`, `pnpm --filter @templjs/context-graph build`, `pnpm --filter @templjs/volar build`
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      DRY refactor and $ref-aware hover follow-up (cb3f6a0):
      - Extracted createScopedPathResolver() shared helper used by completion, hover, and definition
      - Added resolveSchemaUriForContext() to eliminate duplicate zone-kind logic across operations
      - Added resolvePathDefinitionAcrossRefs() fallback to hover path details  (parity with definition)
      - Added SemanticSchemaReadOptions / ResolvedSchemaPathTarget interfaces
      - Token-aware hover for for-iterable statement paths (cursor-segment resolution)
      - Focused tests: 124 passed, 0 failed
      - All package builds confirmed clean
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Test hardening follow-up (1b9ff47):
      - Removed temporary console.debug noise from expression-analysis dynamic segments
      - Reworked memoization coverage to assert public adapter.query() behavior
      - Eliminated private method casting/overrides in adapter tests
      - Focused Volar test: `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)
      - Full Volar suite: 298 passed, 0 failed
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Performance and YAML-frontmatter follow-up (8ab845c, e87096e):
      - Snapshot cache keys now prefer object-identity tokens over full schema serialization
      - Shared scope matching and default-filter caching reduce repeated semantic helper allocations
      - Frontmatter context detection now avoids false nested scopes for YAML block scalars, flow collections, anchors, and aliases
      - Focused verification:
        - `pnpm --filter @templjs/volar test -- test/intellisense-provider.test.ts` (67 passed)
        - `pnpm --filter @templjs/volar test -- test/context-graph-adapter.test.ts` (8 passed)
  - timestamp: 2026-03-17T00:00:00Z
    note: |
      Coverage hardening follow-up (62b21a2, c0bb1c5):
      - Expanded core template-scope and semantic helper coverage used by graph-backed semantic reads
      - Added direct Volar regression suites for schema resolution, expression analysis, and scope resolution helpers
      - Verified package-local Volar coverage gate and full pre-push hook passed after remediation
links:
  implements:
    - '[[056_context_graph_platform_epic]]'
  depends_on:
    - '[[057_context_graph_kernel_and_api]]'
---

## Goal

Introduce a Volar-facing adapter that consumes context graph contracts and migrate semantic read paths (hover/definition/completion) from feature-local resolution logic to graph queries.

## PR Handoff Notes

- No active PR currently tracks this work item.
- Include commit `91d942c` (and backlog traceability commit `b49ae91`) in the next PR.

## Tasks

- [x] Add context graph adapter in `@templjs/volar`
- [x] Route hover resolution through graph query path
- [x] Route definition resolution through graph query path
- [x] Route completion variable-path resolution through graph query path
- [x] Keep fallback behavior while parity is established
- [x] Add regression tests for frontmatter/content and nested scopes

## Acceptance Criteria

- [x] Hover, definition, and completion can resolve through context graph adapter
- [x] Existing feature behavior remains non-regressed
- [x] Tests prove semantic parity for key scenarios
