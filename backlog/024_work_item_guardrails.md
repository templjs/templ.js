---
id: wi-024
type: work-item
subtype: epic
lifecycle: active
title: '024: Implement Work Item Validation & Guardrails'
status: ready-for-review
priority: critical
estimated: 12
assignee: ''
actual: 2
links:
  depends_on:
    - '[[001_github_organization]]'
    - '[[002_monorepo_setup]]'
---

## Goal

Implement objective, machine-verifiable guardrails for work item status claims. Work items can only be marked `completed` if they have merged PRs with passing CI, recorded test results, and all tasks checked. Enforce this via validation script, Husky hooks, and GitHub Actions. Migrate to numeric-only work item IDs and add dependency tracking.

## Background

Current backlog has `status: completed` items without merged PRs, test evidence, or complete tasks. This creates false confidence in delivery. We need:

1. Automated validation that enforces schema rules (merged PR, tests, complete tasks)
2. Husky pre-push gate to block invalid status claims locally
3. GitHub Actions CI gate (authoritative) to prevent merge of invalid claims
4. Dependency tracking to prevent work from starting before blockers are complete
5. Numeric-only work item IDs (migrate 001.5 → 012, etc.)
6. Updated agent skills that enforce constraints during creation/update/finalization

## Deliverables

- TypeScript validation script (`scripts/ci/validate-work-items.ts`) that:
  - Validates work item frontmatter against schema
  - Enforces `completed` status requires: merged PR, passing CI, recorded tests, all tasks `[x]`
  - Enforces `in-progress` status: all dependencies must be `completed`
  - Returns exit code 0/1 with detailed violation reports
- Updated backlog schema with `links.pull_requests` and `links.depends_on` fields
- All decimal work item IDs renamed to numeric format (012, 013, etc.)
- Dependency relationships documented in `links.depends_on` for all items
- Updated agent skills (create-, update-, finalize-work-item) that validate constraints
- Pre-push hook wired to validate all backlog items
- CI job that runs validation as gate on merge
- Normalized backlog with accurate status, dependencies, and evidence

## Tasks

- [x] Create TypeScript validation script at `scripts/ci/validate-work-items.ts`
- [x] Update backlog schema (`schemas/frontmatter/work-item.json`) to add `links.pull_requests` and `links.depends_on`
- [x] Rename work items: 001.5 → 025_schema_validation, 002.5 → 026_cicd_scaffolding_artifact, 012.5 → 027_virtual_code_mapping, 013.5 → 028_textmate_grammar, 018.5 → 029_cli_signal_handling
- [ ] Update all wikilinks in backlog that reference renamed items
- [ ] Add `links.depends_on` to all work items based on dependency analysis
- [ ] Update `create-work-item` skill to enforce numeric-only IDs and prompt for dependencies
- [ ] Update `update-work-item` skill to validate dependencies before `in-progress` transition
- [ ] Update `finalize-work-item` skill to validate merged PR, tests, and complete tasks before `completed`
- [x] Wire validation into `.husky/pre-push` hook
- [x] Add validation job to `.github/workflows/ci.yml`
- [x] Add npm script to `package.json` for running validation (e.g., `validate:work-items`)
- [ ] Normalize all current backlog items: set accurate status, add dependencies, verify evidence exists

## Acceptance Criteria

- [ ] Validation script runs successfully against all backlog items
- [ ] Pre-push hook blocks commits with any invalid work item status
- [ ] GitHub Actions CI validates backlog as gate on merge
- [ ] All work items use numeric IDs only (no decimals)
- [ ] Dependencies tracked and enforced (cannot be `in-progress` if dependency not `completed`)
- [ ] `completed` items verified to have merged PR and tests
- [ ] Agent skills updated to enforce constraints during creation/update/finalization
- [ ] Backlog normalized and passes validation without violations

## References

- Schema: schemas/frontmatter/work-item.json
- Skills: .agents/skills/{create,update,finalize}-work-item/SKILL.md
- Hooks: .husky/pre-push
- CI: .github/workflows/ci.yml
