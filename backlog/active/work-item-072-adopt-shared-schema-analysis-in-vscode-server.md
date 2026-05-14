---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:072-adopt-shared-schema-analysis-in-vscode-server
title: '072: Adopt Shared Schema Analysis in VS Code Server'
summary: Adopt Shared Schema Analysis in VS Code Server
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
    - '[[record-20260514-223855-072-adopt-shared-schema-analysis-in-vscode-server]]'
---

## Goal

Use the shared core schema-analysis path in the VS Code server layer instead of keeping separate schema-analysis behavior in server-side flows.

## Background

The server remains a large mixed-responsibility file and still participates in schema loading and orchestration. Shared schema analysis should be reused there before deeper server decomposition.

## Tasks

- [ ] Audit server-side schema-analysis and schema-metadata call sites.
- [ ] Route reusable schema analysis through core.
- [ ] Preserve transport, configuration, and LSP payload behavior.
- [ ] Capture benchmark evidence for schema-loading and schema-backed request flows.

## Acceptance Criteria

- [ ] Server-side schema-analysis flows reuse the shared core path where appropriate.
- [ ] Existing authoring behavior stays green.
- [ ] Benchmark evidence is attached to the work item.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-069-add-shared-schema-analysis-cache-in-core]]
