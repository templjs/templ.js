---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:124-first-release-candidate-execution-and-evidence
title: '124: First Release Candidate Execution and Evidence'
summary: Coordinate full-stack RC implementation, validation, packaging, and evidence handoff to backlog automation.
type: work-item
subtype: epic
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 12
actual: 12
completed_date: '2026-05-18'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/154
  evidence:
    - '[[record-20260518-225632-124-first-release-candidate-execution-and-evidence]]'
---

## Goal

Coordinate execution of the full templjs RC plan across packages, CLI, Volar, VS Code, release automation, tests, package dry-runs, and VSIX packaging.

## Background

The RC scope now includes release blocker cleanup, shared schema rollout, context-graph optimization, Volar/VS Code responsibility splits, behavior-first test work, structured expression parser migration through the token-driven cutover, and selected bug/feature fixes. Final evidence collation, closure, and archiving are delegated to `backlog-automation`.

## Tasks

- [x] Track required scope across `WI-037`, `WI-041`, `WI-061`, `WI-070` through `WI-087`, `WI-090`, `WI-118`, and `WI-119` through `WI-123`.
- [x] Track `WI-047` through `WI-052` as nice-to-have scope after required validation is green.
- [x] Keep `WI-023` and `WI-088` deferred unless a direct RC blocker appears.
- [x] Record milestone progress after immediate deliverables, release blockers, shared-schema rollout, architecture/parser scope, validation, and optional nice-to-have evaluation.
- [x] Run and record the full validation matrix on Node 24.
- [ ] Hand final work item evidence, closure, and archiving to `backlog-automation`.

## Deliverables

- Full RC validation command results.
- npm package dry-run evidence for every public package.
- VSIX package dry-run evidence.
- Release readiness summary with any remaining blockers.
- Backlog automation handoff note.

## Acceptance Criteria

- [x] Required RC scope has either merged implementation evidence or an explicit blocker recorded.
- [x] Full validation matrix has been run on Node 24.
- [x] Package and VSIX dry-runs succeed or have documented release blockers.
- [x] Work items remain available for `backlog-automation` to finalize rather than being manually archived.

## Relationships
