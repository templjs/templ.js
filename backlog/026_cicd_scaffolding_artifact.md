---
id: wi-026
type: work-item
subtype: task
lifecycle: active
title: '026: CI/CD Scaffolding & Repository Infrastructure (Primary Artifact)'
status: ready-for-review
status_reason: awaiting-review
priority: critical
estimated: 6
actual: 4
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.091Z
    note: Workflow files and docs exist locally; GitHub org not created
commits:
  1768d15: 'chore(core): add ajv dependencies for schema validation'
links:
  depends_on:
    - '[[003_github_actions]]'
    - '[[004_precommit_hooks]]'
---

## Goal

Create comprehensive, production-ready CI/CD infrastructure and repository scaffolding as a v1.0 primary artifact.

## Background

templ.js v1.0 includes formal, documented CI/CD infrastructure beyond standard GitHub Actions. This work item captures the complete scaffolding including:

- GitHub Actions workflow definitions (linting, testing, releasing)
- Pre-commit hook configuration (Husky, lint-staged)
- Local development environment setup
- Repository structure with documented conventions
- Skills/tools documentation
- Development runbook and troubleshooting guide

This is a PRIMARY ARTIFACT of v1.0 alongside code, not a secondary task.

## Tasks

- [x] Document all CI/CD technologies in README:
  - Linting: ESLint, TSDoc, Prettier, ShellCheck, markdownlint, yamllint, folderslint, markdownlint-bash
  - Secret scanning: Two-tier approach (detect-secrets for pre-commit, TruffleHog for periodic scans)
  - Testing: Vitest, coverage reporting (Codecov)
  - Benchmarks: quick benchmarks for pre-commit, scheduled or adhoc rigorous benchmarks ensure no regression from published baseline
  - Build: Nx, pnpm
  - Deployment: GitHub Actions release workflow
  - Code quality: SonarQube or GitHub code scanning

- [x] Create GitHub Actions workflows with documented rationale:
  - `test.yml` - Runs all unit + integration tests +code coverage on PR
  - `static-analysis.yml` - Runs all linting + detect-secrets on PR
  - `benchmark.yml` - Runs quick benchmarks on PR (blocking), comprehensive benchmarks scheduled and on-demand (informational)
  - `trufflehog-scan.yml` - Weekly deep scan of commit history (scheduled, not blocking)
  - `release.yml` - Automated version bumps and documentation + npm publishing
  - All pre-commit checks **must** also be pass on PR; _never_ rely on pre-commit alone
  - Document which workflow checks are required for merge (test and static-analysis must pass; TruffleHog is informational)

- [x] Document all SKILL tools used:
  - List in `.agents/skills-manifest.md`
  - For each skill: purpose, when to use, integration point
  - Example: squirrel289/pax@feature-branch-management, github/awesome-copilot@git-commit, squirrel289/pax@create-pr

- [x] Create local development guide:
  - `DEVELOPMENT.md` with setup steps
  - Time-to-first-commit target: <15 minutes
  - Troubleshooting common issues
  - IDE setup (VSCode extensions, settings)

- [x] Document repository structure:
  - File organization with rationale
  - Naming conventions (files, branches, PRs)
  - Where each piece of documentation lives

- [x] Create pre-commit hook configuration:
  - Husky setup for local validation
  - lint-staged for staged file checking
  - Commitlint for conventional commits
  - `detect-secrets` hook: scan staged files for credentials (AWS keys, API tokens, .env patterns)
  - Quick benchmarks hook: compare against baseline; fail on regression
  - Configuration: with detect-secrets and benchmark and baseline.
  - Document bypass only for urgent hotfixes (rare, requires PR note)

- [x] Document required checks for PR merge:
  - All GitHub Actions must pass
  - Code coverage must not decrease
  - At least 1 approval from maintainer
  - Commits must follow conventional format
  - Benchmarks must not degrade
  - Documentation must be updated and published

- [x] Create runbook for common tasks:
  - How to release a new version
  - How to debug failing tests
  - How to add a new built-in function
  - How to update documentation

## Deliverables

- Documented CI/CD infrastructure (workflows, configs, rationale)
- Skills manifest listing all integrated agent skills
- Development runbook with setup, troubleshooting, common tasks
- Repository structure documentation
- Local dev environment fully functional with <15 min setup
- All linting and secret scanning operational
- Primary artifact documentation (this is v1.0 infrastructure, not a feature)

## Acceptance Criteria

- [x] All CI/CD workflows defined, locally tested with `act`, and documented
- [x] Secret scanning operational and catches test secrets
- [x] Local setup completes within 15 minutes
- [x] First test run succeeds after local setup
- [x] Pre-commit hooks prevent common mistakes (bad formatting, unescaped secrets, failing tests)
- [x] Repository README documents CI/CD, setup, and skill usage
- [x] DEVELOPMENT.md covers all common tasks
- [x] Runbook provides troubleshooting steps
- [x] Skills manifest lists all integrated agent tools
- [x] All linting technologies configured and documented

## Linting Technologies

**TypeScript/JavaScript**: ESLint + Prettier
**Shell Scripts**: ShellCheck (for bash/zsh in scripts/)
**Markdown**: markdownlint (enforce consistent style)
**YAML**: yamllint (GitHub Actions, config files)
**JSON**: JSON validator (package.json, tsconfig.json)
**Overall coordination**: pre-commit hooks via Husky

## Secret Scanning

**Tools**:

- TruffleHog or GitHub's native secret scanning
- Detect patterns: AWS keys, GitHub tokens, API keys, .env files
- Pre-commit hook blocks commits with detected secrets
- CI/CD job scans all pushes as safety net

**Test Cases**:

- Can detect AWS_SECRET_ACCESS_KEY pattern
- Can detect private_key in JSON
- Allows .env.example (no actual secrets)
- Blocks .env with real API keys

## Skills Integration

Document which agent skills are used:

- `squirrel289/pax@feature-branch-management` - Creating/rebasing branches
- `github/awesome-copilot@git-commit` - Conventional commit messages
- `squirrel289/pax@create-pr` - PR creation and description generation
- `squirrel289/pax@finalize-work-item` - Closing work items after merge
- Any other skills leveraged in development workflow

## Development Runbook Outline

1. **Setup** (<15 min)
   - Clone repo
   - Install pnpm, Node.js
   - Run `pnpm install`
   - Run `pnpm setup-husky` (pre-commit hooks)
   - Run `pnpm test` (verify everything works)

2. **Common Tasks**
   - Running tests locally
   - Adding a new built-in function (with schema example)
   - Updating documentation
   - Creating a feature branch
   - Submitting a PR

3. **Troubleshooting**
   - "Husky pre-commit hook blocks my commit" → Check formatting/linting
   - "Tests timeout" → Clear cache with `pnpm vitest --clearCache`
   - "Coverage dropped" → Debug test coverage locally
   - "Secret scanning false positive" → Allowlist patterns in config

## Performance Targets (CI/CD)

- Full test suite: <30 seconds
- Linting: <10 seconds
- Secret scanning: <5 seconds
- Build dist: <2 minutes
- Full PR checks: <5 minutes total

## Dependencies

- Requires: [[1 GitHub Organization]], [[2 Monorepo Setup]], [[3 GitHub Actions]]
- Unblocks: All development work (local setup is blocker)

## References

- Husky documentation: <https://typicode.github.io/husky/>
- TruffleHog: <https://github.com/trufflesecurity/truffleHog>
- ESLint config: `.eslintrc.json` in root
- GitHub Actions: `.github/workflows/`
