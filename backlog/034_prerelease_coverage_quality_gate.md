---
id: wi-034
type: work-item
subtype: task
lifecycle: active
title: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment)'
status: ready
priority: critical
estimated: 8
assignee: ''
commits:
  62b21a2: 'test(core): raise semantic coverage'
  e0ede1a: 'test(context-graph): harden coverage gates'
  c0bb1c5: 'test(volar): add coverage utility suites'
  74e7070: 'test(vscode): harden activation coverage'
  0b66d42: 'chore(testing): isolate cli coverage reports'
test_results:
  - timestamp: 2026-03-17T00:00:00Z
    note: |
      Coverage remediation branch follow-up:
      - Added targeted regression suites for core semantic helpers, context-graph lifecycle/query filtering,
        Volar schema/expression/scope utilities, and VS Code activation tracing/startup handling
      - Isolated per-package coverage output directories to stop parallel pre-push coverage artifact collisions
      - Revalidated the full pre-push gate successfully after remediation
      - Final gate summary:
        - `@templjs/core`: Stmts 96.05%, Branches 90.50%, Funcs 99.40%, Lines 96.25%
        - `@templjs/context-graph`: Stmts 97.00%, Branches 91.66%, Funcs 100.00%, Lines 96.80%
        - `@templjs/volar`: Stmts 85.14%, Branches 71.92%, Funcs 94.57%, Lines 85.33%
        - `vscode-templjs`: Stmts 83.61%, Branches 70.02%, Funcs 91.11%, Lines 83.67%
        - `@templjs/cli`: Stmts 96.32%, Branches 88.29%, Funcs 100.00%, Lines 96.30%
links:
  depends_on:
    - '[[031_language_feature_tests]]'
    - '[[030_reenable_coverage_thresholds]]'
---

## Goal

Reconcile all coverage thresholds in vitest configs to align with ADR-006 target metrics, enable per-file coverage enforcement (perFile mode), and close any remaining coverage gaps to prepare templjs for pre-release quality standards.

## Background

**Current State** (WI-031 completion):

- Global thresholds: lines 95%, functions 99%, branches 75%, statements 95%
- Package thresholds manually set above actual measured coverage
- Coverage enforcement: `perFile: false` (global enforcement only)
- ADR-006 baseline targets: Overall 90%+, Core 95%+, CLI 85%+, Volar 92%+

**Problem**:

- Thresholds were raised to unrealistic levels during WI-031 to pass CI with scattered test suites
- Current config uses global enforcement only, allowing coverage gaps to hide in individual files
- ADR-006 specifies target coverage per package type and metrics, but implementation diverges
- No per-file enforcement means low-coverage files can be masked by high-coverage neighbors

**ADR-006 Reference**:

- Overall: 90%+ (all metrics)
- Core Library: 95%+ (parser, renderer, query engine - strict)
- CLI: 85%+ (command handlers, I/O - relaxed for user-facing code)
- Volar Plugin: 92%+ (language service - medium strictness)
- Note: ADR shows 90% global in example config, but "90%+" and 95%+ in target metrics

**Dependencies**:

- WI-031 consolidated test files and established baseline thresholds
- WI-030 originally re-enabled coverage enforcement

**Related ADR**: [[docs/adr/006-testing.md]]

## Tasks

1. **Audit current measured coverage per package and metric**
   - Run `pnpm run test:affected:ci` and capture detailed v8 coverage reports
   - Extract lines, functions, branches, statements percentages for each file
   - Identify files below ADR-006 target and files well above
   - Document variance across files in a coverage-variance report

2. **Set ADR-006 aligned global thresholds**
   - Update root `vitest.config.ts`:
     - lines: 90% (ADR-006 overall target)
     - functions: 90% (ADR-006 overall target)
     - branches: 90% (ADR-006 overall target)
     - statements: 90% (ADR-006 overall target)
   - Update all package configs to match ADR targets:
     - Core: lines 95%, functions 95%, branches 95%, statements 95%
     - CLI: lines 85%, functions 85%, branches 85%, statements 85%
     - Volar: lines 92%, functions 92%, branches 92%, statements 92%
     - VSCode: lines 90%, functions 90%, branches 90%, statements 90%
   - Remove inline documentation (clean separation of concerns)
   - Document rationale in separate COVERAGE_STRATEGY.md ADR addendum

3. **Enable perFile coverage enforcement**
   - Set `perFile: true` in all vitest configs
   - Review per-file failures and identify coverage gaps:
     - Files below package-level threshold
     - Complex logic with multiple branches insufficiently tested
   - Create GitHub issue per file with coverage gap (or bundle if >5 issues)
   - Estimate additional test coverage work for each file

4. **Close coverage gaps (proportional to gap size)**
   - For high-priority files (>3% below threshold): Add tests immediately
   - For medium-priority files (1-3% below): Queue for next sprint
   - For low-priority files (<1% or utility files): Set per-file override if justified
   - Ensure all tests pass without coverage gaps blocking merge

5. **Validate pre-release quality standards**
   - Confirm all 4 packages meet their ADR-006 targets:
     - `pnpm run test:affected:ci` passes with perFile enforcement
     - All CI checks green (coverage, lint, type-check, build)
     - No coverage warnings in test output
   - Document final measured coverage vs. thresholds in test results
   - Verify no regressions from previous sessions

## Deliverables

- Updated root `vitest.config.ts` with ADR-aligned global thresholds (lines 90%, functions 90%, branches 90%, statements 90%)
- Updated package vitest configs with ADR targets:
  - `src/packages/core/vitest.config.ts` (95% all metrics)
  - `src/packages/cli/vitest.config.ts` (85% all metrics)
  - `src/packages/volar/vitest.config.ts` (92% all metrics)
  - `src/extensions/vscode/vitest.config.ts` (90% all metrics)
- `perFile: true` enabled in all vitest configs
- Coverage variance audit report (identifying files below thresholds)
- GitHub issues or PR comments documenting coverage gaps (if any)
- Additional test coverage to close identified gaps
- Final coverage report confirming all packages meet ADR-006 targets
- `COVERAGE_STRATEGY.md` document explaining threshold policy and per-file enforcement rationale

## Acceptance Criteria

- [ ] All vitest configs updated with ADR-006 aligned thresholds
- [ ] `perFile: true` enabled across all packages
- [ ] `pnpm run test:affected:ci` passes and enforces ≥90% global coverage
- [ ] Core package achieves ≥95% coverage on all metrics (lines, functions, branches, statements)
- [ ] CLI package achieves ≥85% coverage on all metrics
- [ ] Volar package achieves ≥92% coverage on all metrics
- [ ] VSCode extension achieves ≥90% coverage on all metrics
- [ ] No files below package-level threshold (per-file enforcement active)
- [ ] Coverage gaps identified and either closed or documented with per-file overrides
- [ ] Coverage audit report completed and committed
- [ ] All status checks pass (lint, type-check, build, test, coverage)
- [ ] PR reviewed and merged to main before v1.0 release
- [ ] Work item marked closed with `status_reason: completed`

## Notes

- This work item is pre-release quality gate work; block on it before v1.0 release
- Measured coverage can vary between runs; use multiple CI runs to establish stable baseline
- Per-file enforcement may reveal test gaps in utility/edge-case code; use professional judgment for per-file overrides
- If coverage gaps prevent merge, create follow-up spike work items to address systematically post-release
