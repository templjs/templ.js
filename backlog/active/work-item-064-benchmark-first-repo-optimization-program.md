---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:064-benchmark-first-repo-optimization-program
title: '064: Benchmark-First Repo Optimization Program'
summary: Benchmark-First Repo Optimization Program
type: work-item
subtype: epic
lifecycle: active
status: ready
status_reason: prioritized
priority: high
estimated: 24
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-064-benchmark-first-repo-optimization-program]]'
---

## Goal

Track the repo-wide optimization program with a benchmark-first rollout so performance work is measured before refactors are prioritized, implemented, or validated.

## Background

Recent repo-wide analysis shows the main codebase is functionally green, but the remaining opportunities are mostly performance, memory, architecture, and test-structure follow-ups. The program needs one backlog umbrella that enforces a clear rule:

- Benchmarking is the only initial critical path.
- Breaking API changes get their own dedicated high-priority stories only if implementation proves they are necessary.
- True functional blockers get their own concrete bug items only when they are discovered.
- All remaining work is tracked as atomic technical-debt tasks.

## Scope

- Add benchmark foundation and CI publication as the only immediate critical-path work.
- Record remaining production and test follow-ups as technical-debt tasks with explicit dependencies.
- Keep parser-authority and test-colocation follow-ups aligned with existing items `[[work-item-062-authoritative-template-parsing-and-delimiter-parity]]` and `[[work-item-063-colocate-tests-with-primary-target-modules]]`.
- Prevent generic blocker buckets or speculative API-break work items from entering the critical path.

## Tasks

- [ ] Create the benchmark harness work item and mark it ready.
- [ ] Create the benchmark publication and comparison work item and mark it ready.
- [ ] Create atomic technical-debt tasks for remaining production optimizations.
- [ ] Create atomic technical-debt tasks for remaining test-architecture and documentation work.
- [ ] Keep all non-benchmark follow-up work out of the immediate critical path until benchmark publication exists.
- [ ] Create a dedicated high-priority story only if an actual breaking API change is discovered.
- [ ] Create a dedicated bug only if a real functional blocker is discovered.

## Acceptance Criteria

- [ ] Benchmark foundation and benchmark publication items exist as `ready` critical-path work.
- [ ] Remaining repo-wide follow-up work is represented by discrete technical-debt tasks rather than broad catch-all stories.
- [ ] No generic breaking-API or blocker placeholder item is created.
- [ ] Parser-authority and test-colocation work is linked back to the existing relevant backlog items rather than duplicated.

## Child Tasks

- [ ] [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- [ ] [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- [ ] [[work-item-067-extract-authoritative-core-statement-and-expression-analysis]]
- [ ] [[work-item-068-remove-remaining-volar-statement-semantic-duplication]]
- [ ] [[work-item-069-add-shared-schema-analysis-cache-in-core]]
- [ ] [[work-item-070-adopt-shared-schema-analysis-in-volar]]
- [ ] [[work-item-071-adopt-shared-schema-analysis-in-cli]]
- [ ] [[work-item-072-adopt-shared-schema-analysis-in-vscode-server]]
- [ ] [[work-item-073-optimize-context-graph-query-indexes-and-ordering]]
- [ ] [[work-item-074-reuse-query-engine-builtin-registry-and-metadata]]
- [ ] [[work-item-075-split-volar-context-graph-adapter-by-responsibility]]
- [ ] [[work-item-076-split-volar-intellisense-and-diagnostic-providers-by-responsibility]]
- [ ] [[work-item-077-split-vscode-server-into-schema-state-and-lsp-services]]
- [ ] [[work-item-078-colocate-core-and-context-graph-module-tests-with-sources]]
- [ ] [[work-item-079-colocate-volar-and-vscode-module-tests-with-sources]]
- [ ] [[work-item-080-rewrite-cli-tests-toward-behavior-first-public-workflows]]
- [ ] [[work-item-081-rewrite-volar-and-vscode-tests-toward-behavior-first-request-result-coverage]]
- [ ] [[work-item-082-remove-overlapping-test-coverage-and-add-shared-semantic-schema-fixtures]]
- [ ] [[work-item-083-document-benchmark-workflow-semantic-ownership-schema-cache-and-test-conventions]]

## Implementation Notes

- Treat this epic as the sequencing authority for the optimization program, not as an implementation catch-all.
- New breaking-change or blocker items should be created only when discovered by benchmark or implementation work.
- Technical-debt tasks should remain small enough to be implemented and reviewed independently.
