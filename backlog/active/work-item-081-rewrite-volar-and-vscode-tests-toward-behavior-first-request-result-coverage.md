---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage
title: '081: Rewrite Volar and VS Code Tests Toward Behavior-First Request/Result Coverage'
summary: Rewrite Volar and VS Code Tests Toward Behavior-First Request/Result Coverage
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 5
actual: 1
links:
  evidence:
    - '[[record-081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage-evidence-1]]'
---

## Goal

Rewrite Volar and VS Code tests to emphasize request/result behavior over internal call choreography, while keeping only the mocks needed at real process and platform boundaries.

## Background

The repo still has many mock-heavy IDE tests, especially around VS Code activation and server wiring. That makes refactors noisy and reduces confidence in actual authoring behavior.

## Tasks

- [ ] Identify the highest-value mock-heavy suites in Volar and VS Code.
- [ ] Replace internal call assertions with request/result behavior where the boundary is stable.
- [ ] Keep only necessary platform-boundary mocks.
- [ ] Preserve or improve integration coverage for authoring scenarios.

## Acceptance Criteria

- [ ] Volar and VS Code tests focus primarily on observable request/result behavior.
- [ ] Mock-heavy internal choreography assertions are reduced to true boundary cases.
- [ ] Authoring behavior remains green in targeted and integration suites.

## Relationships

- `depends_on`: [[work-item-068-remove-remaining-volar-statement-semantic-duplication]]
- `depends_on`: [[work-item-075-split-volar-context-graph-adapter-by-responsibility]]
- `depends_on`: [[work-item-076-split-volar-intellisense-and-diagnostic-providers-by-responsibility]]
- `depends_on`: [[work-item-077-split-vscode-server-into-schema-state-and-lsp-services]]
