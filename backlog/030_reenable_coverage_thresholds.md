---
id: wi-030
type: work-item
subtype: task
lifecycle: draft
title: '30: Re-enable Coverage Thresholds in CI'
status: proposed
priority: medium
estimated: 1
assignee: ''
actual: 0
links:
  depends_on:
    - '[[009_lexer_tests]]'
    - '[[010_parser_tests]]'
    - '[[011_renderer_tests]]'
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

- [ ] Verify all Phase 2 test suites complete and passing (WI-009, 010, 011)
- [ ] Confirm coverage meets thresholds:
  - [ ] Lines: ≥80%
  - [ ] Functions: ≥80%
  - [ ] Statements: ≥80%
  - [ ] Branches: ≥75%
- [ ] Update `package.json` test:affected:ci to add `--coverage` flag
- [ ] Run CI locally to verify coverage enforcement works
- [ ] Update DEVELOPMENT.md to document coverage requirements
- [ ] Commit and verify CI passes with coverage enabled

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

- [ ] CI enforces 80%/80%/80%/75% coverage thresholds
- [ ] All Phase 2 packages meet threshold requirements
- [ ] Coverage reports generated and available in CI artifacts
- [ ] Documentation updated with coverage guidelines
- [ ] CI pipeline passes with coverage enabled

## Notes

- Coverage thresholds are per-package in `packages/*/vitest.config.ts`
- Query engine and renderer should have highest coverage priority (business logic)
- CLI and extension can have slightly lower thresholds if needed (defer to WI-017, 018)
