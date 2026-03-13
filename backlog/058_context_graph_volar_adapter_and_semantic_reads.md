---
id: wi-058
type: work-item
subtype: task
lifecycle: active
title: '058: Add Volar adapter and migrate semantic reads'
status: ready-for-review
priority: high
estimated: 10
actual: 6
assignee: ''
commits:
  91d942c: 'feat(volar): integrate context graph into semantic reads'
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
