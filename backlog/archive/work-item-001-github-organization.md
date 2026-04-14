---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:001-github-organization
title: '1: Create templjs GitHub Organization'
summary: Create templjs GitHub Organization
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 5
actual: 1
commits:
  22ae441: 'feat(infra): add GitHub templates, CI/CD workflows, and pre-commit hooks'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/1
  evidence:
    - '[[record-001-github-organization-evidence-1]]'
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
- [x] Document manual setup steps (`.github/organization-setup.md`)
- [x] Setup GitHub Pages for documentation site (`docs/` folder)
- [x] Configure repository settings:
  - [x] Disable squash and rebase merges (require squash commits)
  - [x] Auto-delete head branches
  - [x] Require conversation resolution before merge

## Deliverables

- GitHub organization `templjs` created and configured
- Repository `templjs/templ.js` initialized (empty)
- Team members invited with write access

## Acceptance Criteria

- [x] Organization homepage displays at github.com/templjs
- [x] `templjs/templ.js` repository is empty and ready for scaffolding
- [x] Contributors can clone and push to repository
- [x] Organization pages and README configured

## Notes

- Use free GitHub organization (no paid plan required)
- Document organization URL: <https://github.com/templjs>
