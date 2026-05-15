---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:077-split-vscode-server-into-schema-state-and-lsp-services
title: '077: Split VS Code Server into Schema, State, and LSP Services'
summary: Split VS Code Server into Schema, State, and LSP Services
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 4
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-077-split-vscode-server-into-schema-state-and-lsp-services]]'
---

## Goal

Refactor the VS Code server so LSP bootstrap, schema resolution, document state, and supporting services are separated into smaller internal modules.

## Background

`server.ts` remains a large orchestration file with several responsibilities that should become explicit service boundaries before deeper optimization and test cleanup.

## Tasks

- [ ] Define internal service boundaries for bootstrap, schema resolution, and document state.
- [ ] Extract the services while preserving current LSP behavior.
- [ ] Keep integration coverage green during the refactor.
- [ ] Attach benchmark evidence for relevant request and schema-loading paths.

## Acceptance Criteria

- [ ] The server is decomposed into smaller internal services.
- [ ] Current VS Code authoring behavior remains green.
- [ ] Benchmark evidence is captured where the refactor touches hot paths.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-072-adopt-shared-schema-analysis-in-vscode-server]]
