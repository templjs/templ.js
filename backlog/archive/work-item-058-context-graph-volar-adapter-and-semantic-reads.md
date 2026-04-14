---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:058-context-graph-volar-adapter-and-semantic-reads
title: '058: Add Volar adapter and migrate semantic reads'
summary: Add Volar adapter and migrate semantic reads
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 10
actual: 10
commits:
  91d942c: 'feat(volar): integrate context graph into semantic reads'
  cb3f6a0: 'feat(context-graph): complete graph-backed semantic resolution'
  1b9ff47: 'test(volar): remove debug logging and de-instrument memoization test'
  8ab845c: 'perf(ide): optimize schema resolution and semantic caches'
  e87096e: 'fix(volar): avoid false YAML frontmatter scopes'
  62b21a2: 'test(core): raise semantic coverage'
  c0bb1c5: 'test(volar): add coverage utility suites'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/27
  evidence:
    - '[[record-058-context-graph-volar-adapter-and-semantic-reads-evidence-1]]'
    - '[[record-058-context-graph-volar-adapter-and-semantic-reads-evidence-2]]'
    - '[[record-058-context-graph-volar-adapter-and-semantic-reads-evidence-3]]'
    - '[[record-058-context-graph-volar-adapter-and-semantic-reads-evidence-4]]'
    - '[[record-058-context-graph-volar-adapter-and-semantic-reads-evidence-5]]'
    - '[[record-058-context-graph-volar-adapter-and-semantic-reads-evidence-6]]'
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

## Relationships

- `depends_on`: [[work-item-057-context-graph-kernel-and-api]]
