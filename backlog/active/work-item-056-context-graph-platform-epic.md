---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:056-context-graph-platform-epic
title: '056: Context Graph Platform (N-provider semantic foundation)'
summary: Context Graph Platform (N-provider semantic foundation)
type: work-item
subtype: epic
lifecycle: active
status: in-progress
status_reason: implementation
priority: high
estimated: 30
actual: 13
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
links:
  evidence:
    - '[[record-056-context-graph-platform-epic-evidence-1]]'
    - '[[record-056-context-graph-platform-epic-evidence-2]]'
    - '[[record-056-context-graph-platform-epic-evidence-3]]'
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

- [x] [[work-item-057-context-graph-kernel-and-api]]
- [x] [[work-item-058-context-graph-volar-adapter-and-semantic-reads]]
- [x] [[work-item-059-context-graph-api-boundary-and-rust-ready-contracts]]
- [ ] [[work-item-060-context-graph-hover-definition-exclusive-cutover]]

## Relationships

- `depends_on`: [[work-item-054-bug-no-schema-aware-authoring]]
