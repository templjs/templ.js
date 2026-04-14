---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:057-context-graph-kernel-and-api
title: '057: Build context graph kernel and provider/query API'
summary: Build context graph kernel and provider/query API
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 10
actual: 4
commits:
  82c8de1: 'feat(context-graph): add package and core semantic scope API'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/27
  evidence:
    - '[[record-057-context-graph-kernel-and-api-evidence-1]]'
---

## Goal

Implement the initial `@templjs/context-graph` package with a minimal graph kernel, provider lifecycle hooks, deterministic query API, and versioned contract types.

## PR Handoff Notes

- No active PR currently tracks this work item.
- Include commit `82c8de1` (and backlog traceability commit `b49ae91`) in the next PR.

## Tasks

- [x] Scaffold package structure under `src/packages/context-graph/`
- [x] Define package-owned public contract types (`ProviderId`, `NodeId`, `Fact`, `QueryRequest`, `QueryResponse`, `Delta`)
- [x] Add first-class `profile` to node/edge facts and query filters
- [x] Implement provider registration (`use`), invalidation (`invalidate`), and close (`close`) lifecycle
- [x] Implement deterministic query/read APIs and versioned query contract methods
- [x] Add unit tests for lifecycle, query determinism, and snapshot behavior

## Acceptance Criteria

- [x] Package builds successfully
- [x] Core graph API works for N >= 1 providers
- [x] Query contract supports profile-filtered reads
- [x] Query request/response contracts are versioned (`v1`)
- [x] Query ordering is deterministic across repeated runs
- [x] Tests cover provider add/remove and incremental updates
