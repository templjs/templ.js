---
id: wi-001
type: work-item
subtype: task
lifecycle: active
title: '1: Create templjs GitHub Organization'
status: closed
status_reason: completed
priority: critical
estimated: 5
assignee: ''
test_results:
  - timestamp: 2026-02-19T08:14:01.072Z
    note: 'GitHub org templjs created'
actual: 1
completed_date: 2026-01-15
commits:
  22ae441: 'feat(infra): add GitHub templates, CI/CD workflows, and pre-commit hooks'
links:
  commits:
    - 'https://github.com/templjs/templ.js/commit/22ae441'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/1'
---

## Goal

Establish GitHub organization `templjs` with proper team structure, permissions, and branding.

## Background

Establish templjs organization for professional presentation and team collaboration.

**Related ADRs**: [[ADR-004 Branding]]

## Tasks

- [x] Create GitHub organization `templjs`
- [x] Add team members with appropriate roles (maintainer, contributor, documentation)
- [x] Create `templ.js` repository under `templjs` organization
- [x] Create issue templates:
  - [x] `.github/ISSUE_TEMPLATE/bug_report.md` (Stack trace, reproduction steps)
  - [x] `.github/ISSUE_TEMPLATE/feature_request.md` (Use case, acceptance criteria)
  - [x] `.github/ISSUE_TEMPLATE/adr_proposal.md` (Decision rationale, alternatives)
- [x] Create pull request template (`.github/pull_request_template.md`):
  - [x] Auto-populated checklist (tests, docs, breaking changes)
  - [x] Link to related issues
  - [x] Performance impact section
- [x] Create automation script for branch protection (`.github/scripts/setup-branch-protection.sh`)
- [x] Document manual setup steps (`.github/ORGANIZATION_SETUP.md`)
- [ ] Setup GitHub Pages for documentation site (`docs/` folder)
- [ ] Configure repository settings:
  - [ ] Disable squash and rebase merges (require conventional commits)
  - [ ] Auto-delete head branches
  - [ ] Require conversation resolution before merge

## Deliverables

- GitHub organization `templjs` created and configured
- Repository `templjs/templ.js` initialized (empty)
- Team members invited with write access

## Acceptance Criteria

- [ ] Organization homepage displays at github.com/templjs
- [ ] `templjs/templ.js` repository is empty and ready for scaffolding
- [ ] Contributors can clone and push to repository
- [ ] Organization pages and README configured

## Notes

- Use free GitHub organization (no paid plan required)
- Document organization URL: <https://github.com/templjs>
