---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:110-language-server-host-crash-rca-and-stabilization
title: '110: Language server host crash RCA and stabilization'
summary: Perform root-cause analysis for sporadic language-server host crashes (including hover-path interactions) and implement verified stabilization fixes with regression tests.
type: work-item
subtype: bug
lifecycle: active
status: ready
priority: high
estimated: 5
actual: 0
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

- [ ] Capture crash signatures, stack traces, and request context.
- [ ] Build minimal reproducible fixtures (including hover and diagnostics paths).
- [ ] Add defensive guards around identified null/invalid-state paths.
- [ ] Implement targeted fix for confirmed root cause.
- [ ] Add regression tests that fail pre-fix and pass post-fix.
- [ ] Add lightweight runtime diagnostics to aid future crash triage.

## Deliverables

- RCA record with confirmed root cause.
- Stabilization patch.
- Regression test coverage.

## Acceptance Criteria

- [ ] Crash is reproducible pre-fix and non-reproducible post-fix.
- [ ] Hover and diagnostics paths are stable under repeated request load.
- [ ] No new server startup regressions introduced.
- [ ] Build/test and frontmatter validation pass.
