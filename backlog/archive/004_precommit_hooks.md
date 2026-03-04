---
id: wi-004
type: work-item
subtype: task
lifecycle: active
title: '4: Configure Pre-Commit Hooks and Linting'
status: closed
status_reason: completed
priority: critical
estimated: 4
completed_date: 2026-03-04
actual: 5
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.077Z
    note: Local hooks and configs exist; external org setup not verified
commits:
  22ae441: 'feat(infra): add GitHub templates, CI/CD workflows, and pre-commit hooks'
links:
  depends_on:
    - '[[002_monorepo_setup]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/1'
---

## Goal

Setup Husky, ESLint, Prettier, and Commitlint for automated code quality enforcement.

## Background

Prevents bad commits, inconsistent formatting, and non-conventional commit messages. Improves developer experience with auto-fixes and clear feedback.

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [x] Initialize Husky git hooks
- [x] Create `.eslintrc.json` with TypeScript rules
- [x] Create `.prettierrc.json` with code format rules
- [x] Create `.editorconfig` for editor consistency
- [x] Create `.husky/pre-commit` hook running lint-staged
- [x] Create `.husky/commit-msg` hook with commitlint
- [x] Setup lint-staged configuration in `package.json`
- [x] Create `.commitlintrc.json` enforcing conventional commits
- [x] Test hooks with sample commits

## Deliverables

- All linting and formatting configuration files
- Husky hooks installed and functional
- Pre-commit linting and formatting working
- Commit message validation working

## Acceptance Criteria

- [x] `pnpm install` runs husky setup
- [x] Bad TypeScript code fails `pnpm lint`
- [x] `pnpm format` fixes formatting automatically
- [x] Bad commit message rejected by commit-msg hook
- [x] Valid commit message accepted
- [x] Pre-commit hook fixes auto-fixable issues

## References

- [DEVELOPMENT Commit Policies](/DEVELOPMENT.md#pre-commit-hooks)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Husky Documentation](https://typicode.github.io/husky/)
