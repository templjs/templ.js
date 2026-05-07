---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:110-language-server-host-crash-rca-and-stabilization
title: '110: Language server host crash RCA and stabilization'
summary: Perform root-cause analysis for sporadic language-server host crashes (including hover-path interactions) and implement verified stabilization fixes with regression tests.
type: work-item
subtype: bug
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 5
actual: 0
completed_date: '2026-05-07'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/89
  evidence:
    - '[[record:wi-110-merge-evidence-2026-05-07]]'
---

## Goal

Identify and eliminate sporadic language-server host crashes with reproducible evidence and regression coverage.

## Background

Crash reports were observed during PoC cycles, with hover-path behavior suspected but not confirmed. Reliability must be restored before expanding adapter surface area.

## Scope

- Reproduce and classify crash signatures.
- Isolate crash path(s) and trigger conditions.
- Implement targeted stabilization fix(es).
- Add regression tests and runtime assertions.

## Tasks

- [x] Capture crash signatures, stack traces, and request context.
- [x] Build minimal reproducible fixtures (including hover and diagnostics paths).
- [x] Add defensive guards around identified null/invalid-state paths.
- [x] Implement targeted fix for confirmed root cause.
- [x] Add regression tests that fail pre-fix and pass post-fix.
- [x] Add lightweight runtime diagnostics to aid future crash triage.

## Deliverables

- RCA record with confirmed root cause.
- Stabilization patch.
- Regression test coverage.

## Acceptance Criteria

- [x] Crash is reproducible pre-fix and non-reproducible post-fix.
- [x] Hover and diagnostics paths are stable under repeated request load.
- [x] No new server startup regressions introduced.
- [x] Build/test and frontmatter validation pass.
