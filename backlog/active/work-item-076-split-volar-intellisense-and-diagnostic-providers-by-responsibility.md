---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:076-split-volar-intellisense-and-diagnostic-providers-by-responsibility
title: '076: Split Volar IntelliSense and Diagnostic Providers by Responsibility'
summary: Split Volar IntelliSense and Diagnostic Providers by Responsibility
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: medium
estimated: 4
actual: 0
---

## Goal

Split the large Volar provider modules so targeting, semantic analysis, result assembly, and remapping logic are easier to optimize, benchmark, and test.

## Background

`intellisense-provider.ts` and `diagnostic-provider.ts` still carry several distinct responsibilities, making them hard to reason about and expensive to evolve.

## Tasks

- [ ] Define smaller internal provider boundaries.
- [ ] Extract focused modules for analysis, targeting, assembly, and remapping responsibilities.
- [ ] Preserve request behavior, result shapes, and current diagnostics/completion output.
- [ ] Add or update benchmark and regression evidence.

## Acceptance Criteria

- [ ] Provider responsibilities are split into smaller modules.
- [ ] Existing completion and diagnostic behavior remains green.
- [ ] Benchmark evidence is attached where hot paths change.

## Relationships

- `depends_on`: [[work-item-065-repo-wide-benchmark-harness-and-deterministic-fixtures]]
- `depends_on`: [[work-item-066-publish-benchmark-baselines-and-pr-comparisons-in-cicd]]
- `depends_on`: [[work-item-068-remove-remaining-volar-statement-semantic-duplication]]
- `depends_on`: [[work-item-070-adopt-shared-schema-analysis-in-volar]]
