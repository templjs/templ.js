---
id: wi-056
type: work-item
subtype: epic
lifecycle: active
title: '056: Context Graph Platform (N-provider semantic foundation)'
status: in-progress
priority: high
estimated: 30
actual: 13
assignee: ''
commits:
  ad4e642: 'docs(context-graph): add ADR and update WI status'
  82c8de1: 'feat(context-graph): add package and core semantic scope API'
  91d942c: 'feat(volar): integrate context graph into semantic reads'
  cb3f6a0: 'feat(context-graph): complete graph-backed semantic resolution'
  91b879c: 'fix(volar): add .tpl template marker and suffix file extension detection'
  f276da3: 'feat(vscode): add .tmpl language associations and YAML scalar tokenization'
  74ec91a: 'fix(core): harden query helpers and add regressions'
  3eef8cb: 'test(vscode): use pathToFileURL for mock definition URIs'
  1b9ff47: 'test(volar): remove debug logging and de-instrument memoization test'
  4c524c2: 'fix(context-graph): improve contract diagnostics and boundary checks'
  8ab845c: 'perf(ide): optimize schema resolution and semantic caches'
  e87096e: 'fix(volar): avoid false YAML frontmatter scopes'
  db623c1: 'fix(vscode): surface language client startup failures'
  62b21a2: 'test(core): raise semantic coverage'
  e0ede1a: 'test(context-graph): harden coverage gates'
  c0bb1c5: 'test(volar): add coverage utility suites'
  74e7070: 'test(vscode): harden activation coverage'
test_results:
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Epic-level architecture correction:
      - Semantic markdown/frontmatter alias translation and operation contracts are now owned by `@templjs/core`
      - `@templjs/context-graph` reasserted as generic contracts/engine only
      - Volar consumes core semantic helpers while retaining context-graph generic query contracts
      - Package builds and focused tests re-run successfully after correction
  - timestamp: 2026-03-13T00:00:00Z
    note: |
      Follow-up hardening across context-graph, Volar, and VS Code:
      - Context graph query version errors now report both received and expected contract versions
      - API boundary tests require prebuilt artifacts instead of invoking package builds inline
      - IDE schema resolution now avoids blocking file checks on the async server path and caches semantic snapshot/filter helpers
      - YAML frontmatter completion no longer opens nested scopes for block scalars, flow collections, anchors, or aliases
      - Focused verification: 146 passed, 0 failed across core/context-graph/volar/vscode targeted suites
  - timestamp: 2026-03-17T00:00:00Z
    note: |
      Coverage hardening follow-up (62b21a2, e0ede1a, c0bb1c5, 74e7070):
      - Added focused regression coverage across core semantic helpers, context-graph lifecycle/query filtering,
        Volar semantic utility helpers, and VS Code activation traces
      - Isolated package coverage outputs to make parallel pre-push checks deterministic
      - Pre-push validation passed with all affected package coverage thresholds met or exceeded
links:
  depends_on:
    - '[[054_bug_no_schema_aware_authoring]]'
---

## Goal

Establish `@templjs/context-graph` as a reusable semantic foundation for N independent providers and migrate editor/runtime semantic resolution to graph-backed contracts.

## PR Handoff Notes

- No active PR currently tracks this epic.
- Include commits `ad4e642`, `82c8de1`, `91d942c`, and `b49ae91` in the next PR.

## Scope

- New package scaffold and public API boundary
- First-class profile model in graph facts/edges
- Versioned query request/response contract
- Provider lifecycle and graph query core
- Volar integration for hover/definition/completion
- Diagnostics and schema integration
- Rust-ready contract hardening and dependency-leak checks

## Acceptance Criteria

- [x] `@templjs/context-graph` package exists with stable public API
- [x] Profile-aware graph facts and queries are supported
- [x] Versioned query contract (`request` / `response`) is defined and tested
- [x] Public API exposes no third-party dependency symbols
- [x] At least one Volar feature path reads through context graph contracts
- [x] Regression tests prove deterministic query results
- [x] API boundary checks enforce no dependency leakage

## Child Tasks

- [x] [[057_context_graph_kernel_and_api]]
- [x] [[058_context_graph_volar_adapter_and_semantic_reads]]
- [x] [[059_context_graph_api_boundary_and_rust_ready_contracts]]
- [ ] [[060_context_graph_hover_definition_exclusive_cutover]]
