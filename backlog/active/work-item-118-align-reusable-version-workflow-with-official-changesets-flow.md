---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:118-align-reusable-version-workflow-with-official-changesets-flow
title: '118: Align reusable version workflow with official Changesets flow'
summary: Align shared reusable version workflow inputs and usage with the official Changesets GitHub Action pattern and remove local deviations.
type: work-item
subtype: task
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 3
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-118-align-reusable-version-workflow-with-official-changesets-flow]]'
---

## Goal

Align repository release automation with the official Changesets GitHub Action flow by updating how the shared reusable version workflow is configured and consumed.

## Background

The reusable workflow in `calan-co/cicd-shared-pipeline/.github/workflows/reusable-node-package-version.yml@v1` wraps `changesets/action@v1` but has gaps and drift versus the canonical Changesets flow:

- `package-name` input is required but unused.
- Default `registry-url` points to `https://npm.pkg.github.com` while package publishing targets npmjs in this repo.
- The reusable workflow handles only version PR creation; publish orchestration remains custom and split across separate release logic.
- Local caller behavior relies on custom scripts and conventions that diverge from standard `changesets/action` wiring.

## Tasks

- [ ] Inventory all callers of the reusable version workflow and document current inputs/assumptions.
- [ ] Update the reusable workflow contract to remove or justify unused inputs (notably `package-name`) and align defaults with npmjs-oriented usage.
- [ ] Define backward-compatibility handling for reusable workflow contract changes (deprecate vs remove inputs) and communicate migration guidance for downstream callers.
- [ ] Define and apply a canonical Changesets action contract (version PR path and publish path responsibilities) between shared workflow and repo workflows.
- [ ] Update this repo workflow usage to consume the aligned contract and remove redundant custom wiring where feasible.
- [ ] Update the reusable workflow reference in this repository to the aligned tag/SHA and validate caller compatibility.
- [ ] Audit and update local release scripts under `scripts/release/` that currently diverge from canonical Changesets responsibilities.
- [ ] Add/update workflow tests or dry-run validation steps for both version PR and publish triggers.
- [ ] Define rollout and rollback criteria for the workflow contract migration across shared-pipeline and repository consumers.
- [ ] Document the aligned process in release docs with explicit branch/tag behavior.

## Deliverables

- Updated reusable workflow spec and implementation in shared pipeline repository.
- Updated repo workflow usage aligned to the new contract.
- Reusable workflow version pin update in this repository (new tag or pinned SHA) with migration notes.
- Updated local release scripts where canonical Changesets ownership boundaries are enforced.
- Validation evidence for version PR creation and release publish paths.
- Explicit rollout sequence and fallback plan covering both repositories.
- Documentation updates describing the official-style process.

## Acceptance Criteria

- [ ] Reusable workflow inputs are all used and match intended behavior.
- [ ] Default registry/config values are consistent with this repository's publish targets.
- [ ] Version PR creation follows official Changesets action conventions without redundant custom behavior.
- [ ] Publish path responsibilities are explicit, tested, and documented.
- [ ] Backward-compatibility impact for existing reusable workflow consumers is documented and validated.
- [ ] Repository caller is updated to the aligned reusable workflow ref and verified in CI.
- [ ] Rollout and rollback procedures are documented and tested via dry-run or equivalent validation.
- [ ] CI/release validation demonstrates no regression in existing release automation outcomes.
