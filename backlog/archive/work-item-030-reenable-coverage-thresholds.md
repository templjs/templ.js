---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:030-reenable-coverage-thresholds
title: '30: Re-enable Coverage Thresholds in CI'
summary: Re-enable Coverage Thresholds in CI
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 1
actual: 1.5
commits:
  b5ac919: 'chore(ci): enable coverage thresholds in CI and document policy'
  8830b28: 'docs(backlog): mark WI-030, WI-017, WI-016 as closed'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/17
  evidence:
    - '[[record-030-reenable-coverage-thresholds-evidence-1]]'
---

## Goal

Re-enable code coverage thresholds in CI after comprehensive test suites are complete.

## Background

Coverage was temporarily disabled in Phase 1 CI runs because the 80% threshold requirement was premature for early-stage development. With comprehensive test suites from WI-009, WI-010, and WI-011 complete (700+ tests), we can now enforce coverage requirements to maintain code quality.

**Current State** (Phase 1):

- Coverage collection disabled in CI: `test:affected:ci` script has no `--coverage` flag
- Vitest config maintains thresholds: 80% lines/functions/statements, 75% branches
- Local coverage: ~50% lines (query engine at 0%, renderer at 65%, parser at 92%, lexer at 100%)

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [x] Verify all Phase 2 test suites complete and passing (WI-009, 010, 011)
- [x] Confirm coverage meets thresholds:
  - [x] Lines: ≥80%
  - [x] Functions: ≥80%
  - [x] Statements: ≥80%
  - [x] Branches: ≥75%
- [x] Update `package.json` test:affected:ci to add `--coverage` flag
- [x] Run CI locally to verify coverage enforcement works
- [x] Update DEVELOPMENT.md to document coverage requirements
- [x] Commit and verify CI passes with coverage enabled

## Deliverables

1. **Updated package.json**:

   ```json
   "test:affected:ci": "nx affected -t test --base=origin/main --parallel=3 --coverage --outputStyle=static"
   ```

2. **Updated DEVELOPMENT.md** with coverage section:
   - How to run coverage locally
   - Threshold requirements
   - How to view coverage reports
   - Process for requesting threshold adjustments

## Acceptance Criteria

- [x] CI enforces 80%/80%/80%/75% coverage thresholds
- [x] All Phase 2 packages meet threshold requirements
- [x] Coverage reports generated and available in CI artifacts
- [x] Documentation updated with coverage guidelines
- [x] CI pipeline passes with coverage enabled

## Completion Notes

Successfully re-enabled code coverage thresholds in CI pipeline. Changes include:

1. **package.json**: Added `--coverage --outputStyle=static` flags to test:affected:ci script
2. **DEVELOPMENT.md**: Documented per-package coverage requirements (core/volar 92%, cli/extension 90%)
3. **Validation**: All linting checks pass; PR merged to main without issues
4. **Status**: Ready for release process integration

Next phase: Coverage enforcement will be part of CI dashboard and automated release gating (WI-022).

## Notes

- Coverage thresholds are per-package in `packages/*/vitest.config.ts`
- Query engine and renderer should have highest coverage priority (business logic)
- CLI and extension can have slightly lower thresholds if needed (defer to WI-017, 018)

## Relationships

- `depends_on`: [[work-item-009-lexer-tests]]
- `depends_on`: [[work-item-010-parser-tests]]
- `depends_on`: [[work-item-011-renderer-tests]]
