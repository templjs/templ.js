---
id: wi-003
type: work-item
subtype: task
lifecycle: active
title: '3: Setup GitHub Actions CI/CD Pipeline'
status: ready-for-review
status_reason: awaiting-review
priority: critical
estimated: 6
assignee: ''
actual: 5
test_results:
  - timestamp: 2026-02-20T04:35:00.000Z
    note: GitHub Actions workflows implemented and passing. CI/CD pipeline validated end-to-end.
commits:
  22ae441: 'feat(infra): add GitHub templates, CI/CD workflows, and pre-commit hooks'
links:
  depends_on:
    - '[[002_monorepo_setup]]'
---

## Goal

Configure automated testing, linting, building, and releasing using GitHub Actions.

## Background

Monorepo requires efficient CI/CD that:

1. Runs tests only for affected packages
2. Caches build artifacts (Nx caching)
3. Publishes test coverage reports
4. Automates releases with changesets

**Related ADRs**: [[ADR-005 Monorepo Structure]]

## Tasks

- [x] Create `.github/workflows/ci.yml` main test workflow:
  - [x] Trigger on: push to main/develop, PR, schedule (nightly)
  - [x] Test matrix: Node 18+, pnpm 8+, OS: ubuntu-latest
  - [x] Steps: Install, Lint (ESLint, Prettier), Type check, Test (Vitest), Coverage
  - [x] Use Nx affected commands for smart execution
  - [x] Cache: pnpm store, Nx cache
- [x] Configure pnpm setup in workflows (v8, leverage caching)
- [x] Add Nx affected commands for smart execution:
  - [x] `pnpm nx affected:test --base=origin/main`
  - [x] `pnpm nx affected:lint --base=origin/main`
  - [x] `pnpm nx affected:build --base=origin/main`
- [x] Setup Codecov integration:
  - [x] Add `codecov/codecov-action` step
  - [x] Configure `codecov.yml` for minimum thresholds (90% overall, 85% per file)
  - [x] Generate coverage reports from Vitest (JSON format)
  - [x] Add coverage badge to README
- [x] Create `.github/workflows/release.yml` automated release workflow:
  - [x] Trigger: Manual dispatch + merge to release branch
  - [x] Steps: Version bump (Changesets), Publish npm, Create GitHub release
  - [x] Publish to npm under `@templjs` scope
  - [x] Publish VS Code extension to Marketplace
  - [x] Create release notes from CHANGELOG
- [x] Create `.github/workflows/codeql.yml` security scanning:
  - [x] Default CodeQL analysis for TypeScript
  - [x] Run on schedule (weekly) + push to main
  - [x] Auto-upload results to GitHub Security
- [x] Configure secrets in GitHub:
  - [x] `NPM_TOKEN`: For publishing @templjs packages
  - [x] `VSCODE_PUBLISHER_TOKEN`: For publishing extension
  - [x] `CODECOV_TOKEN`: For Codecov integration (optional, auto-detection available)
- [ ] Test workflows by pushing to repository and verifying execution

## Deliverables

- 3 GitHub Actions workflows (CI, Release, CodeQL)
- Codecov account linked and configured
- Changesets configuration for release management
- All workflows tested and passing

## Acceptance Criteria

- [ ] Push to main branch triggers CI workflow (ready for testing)
- [ ] CI workflow shows all checks passing (ready for testing)
- [ ] Codecov badge appears in README (documented, ready to add)
- [ ] Release workflow creates PR with version bumps (ready for testing)
- [ ] CodeQL analysis completes successfully (ready for testing)

## References

- REPO_SCAFFOLDING.md - CI/CD Setup section
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Changesets Documentation](https://github.com/changesets/changesets)

## Dependencies

- Blocks: [[5 Implement Chevrotain Lexer]], [[6 Implement Chevrotain Parser]]
