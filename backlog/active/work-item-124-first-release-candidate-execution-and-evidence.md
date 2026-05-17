---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:124-first-release-candidate-execution-and-evidence
title: '124: First Release Candidate Execution and Evidence'
summary: Coordinate full-stack RC implementation, validation, packaging, and evidence handoff to backlog automation.
type: work-item
subtype: epic
lifecycle: active
status: ready
status_reason: prioritized
priority: critical
estimated: 12
actual: 0
links:
  evidence:
    - '[[record-20260516-124-first-release-candidate-execution-and-evidence]]'
---

## Goal

Coordinate execution of the full templjs RC plan across packages, CLI, Volar, VS Code, release automation, tests, package dry-runs, and VSIX packaging.

## Background

The RC scope now includes release blocker cleanup, shared schema rollout, context-graph optimization, Volar/VS Code responsibility splits, behavior-first test work, structured expression parser migration through the token-driven cutover, and selected bug/feature fixes. Final evidence collation, closure, and archiving are delegated to `backlog-automation`.

## Tasks

- [ ] Track required scope across `WI-037`, `WI-041`, `WI-061`, `WI-070` through `WI-087`, `WI-090`, `WI-118`, and `WI-119` through `WI-123`.
- [ ] Track `WI-047` through `WI-052` as nice-to-have scope after required validation is green.
- [ ] Keep `WI-023` and `WI-088` deferred unless a direct RC blocker appears.
- [ ] Record milestone progress after immediate deliverables, release blockers, shared-schema rollout, architecture/parser scope, validation, and optional nice-to-have evaluation.
- [ ] Run and record the full validation matrix on Node 24.
- [ ] Hand final work item evidence, closure, and archiving to `backlog-automation`.

## Deliverables

- Full RC validation command results.
- npm package dry-run evidence for every public package.
- VSIX package dry-run evidence.
- Release readiness summary with any remaining blockers.
- Backlog automation handoff note.

## Acceptance Criteria

- [ ] Required RC scope has either merged implementation evidence or an explicit blocker recorded.
- [ ] Full validation matrix has been run on Node 24.
- [ ] Package and VSIX dry-runs succeed or have documented release blockers.
- [ ] Work items remain available for `backlog-automation` to finalize rather than being manually archived.

## Relationships

- `depends_on`: [[work-item-037-volar-crlf-offset-mapping]]
- `depends_on`: [[work-item-041-cli-progress-zero-byte-guard]]
- `depends_on`: [[work-item-061-multiple-filter-signatures]]
- `depends_on`: [[work-item-070-adopt-shared-schema-analysis-in-volar]]
- `depends_on`: [[work-item-071-adopt-shared-schema-analysis-in-cli]]
- `depends_on`: [[work-item-072-adopt-shared-schema-analysis-in-vscode-server]]
- `depends_on`: [[work-item-073-optimize-context-graph-query-indexes-and-ordering]]
- `depends_on`: [[work-item-074-reuse-query-engine-builtin-registry-and-metadata]]
- `depends_on`: [[work-item-075-split-volar-context-graph-adapter-by-responsibility]]
- `depends_on`: [[work-item-076-split-volar-intellisense-and-diagnostic-providers-by-responsibility]]
- `depends_on`: [[work-item-077-split-vscode-server-into-schema-state-and-lsp-services]]
- `depends_on`: [[work-item-078-colocate-core-and-context-graph-module-tests-with-sources]]
- `depends_on`: [[work-item-079-colocate-volar-and-vscode-module-tests-with-sources]]
- `depends_on`: [[work-item-080-rewrite-cli-tests-toward-behavior-first-public-workflows]]
- `depends_on`: [[work-item-081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage]]
- `depends_on`: [[work-item-082-remove-overlapping-test-coverage-and-add-shared-semantic-schema-fixtures]]
- `depends_on`: [[work-item-083-document-benchmark-workflow-semantic-ownership-schema-cache-and-test-conventions]]
- `depends_on`: [[work-item-085-structured-expression-parser-ast-migration-epic]]
- `depends_on`: [[work-item-086-expression-ast-contract-and-semantic-ir]]
- `depends_on`: [[work-item-087-token-driven-expression-parser-cutover]]
- `depends_on`: [[work-item-090-typedoc-coverage-ratcheting]]
- `depends_on`: [[work-item-118-align-reusable-version-workflow-with-official-changesets-flow]]
- `depends_on`: [[work-item-119-fix-vscode-extension-lint-script-nx-forwarded-args]]
- `depends_on`: [[work-item-120-normalize-vscode-extension-package-identity-and-changesets]]
- `depends_on`: [[work-item-121-publish-all-public-templjs-packages-in-release-lanes]]
- `depends_on`: [[work-item-122-document-semantify-release-model]]
- `depends_on`: [[work-item-123-trim-and-verify-vsix-package-file-set]]
