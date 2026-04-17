# Release Drill — Prerelease Execution Playbook (Full)

## Purpose

Drive the repository from unknown or partially-ready state to a validated prerelease publish across npm, VS Code Marketplace, and GitHub.

---

## Core Principles

- Repository rules override agent assumptions
- Changesets are the only valid versioning mechanism
- Prefer repo-native release flow
- Fix only what is necessary
- Stop on ambiguity

---

## Phase 1 — Full State Assessment

### Local

rtk git status
rtk git branch --show-current
rtk pnpm -r list --depth 0
rtk pnpm build
rtk pnpm test

Inspect:

- uncommitted changes
- changesets
- build/test readiness
- publish targets

### GitHub

- active branch
- open PRs
- release tags
- CI/CD status

### npm

rtk npm dist-tag ls `<package-name>`

### VS Code Marketplace

- latest published extension version
- compare to local

Output:

- summaries per system
- risks
- blockers
- next step

---

## Phase 2 — Gap Analysis

Classify blockers:

- repo state
- build/test
- versioning
- CI/CD
- npm
- VS Code Marketplace

Output:

- critical path
- non-critical issues
- execution plan

---

## Phase 3 — Preflight & Dry Run

rtk pnpm install
rtk pnpm build
rtk pnpm test
rtk npm pack --dry-run
rtk npx vsce package --pre-release

Classify failures:

- metadata
- packaging
- scripts
- versioning
- source
- credentials

---

## Phase 4 — Low-Risk Repair

Allowed:

- metadata
- packaging
- scripts
- changelog
- changesets

Forbidden:

- large refactors
- manual version edits

Loop:
fix → validate → reassess

---

## Phase 5 — Versioning Verification

- changesets valid
- npm packages aligned
- extension independent
- no manual edits

---

## Phase 6 — CI Validation

- release branch
- workflow readiness
- credentials

---

## Phase 7 — Go / No-Go

Evaluate readiness:

- build/test
- packaging
- versioning
- CI
- publish

---

## Phase 8 — Publish

- execute repo-native flow
- do not improvise
- stop on failure

---

## Phase 9 — Verify

Check:

- npm publish
- extension publish
- CI success

---

## Phase 10 — Closeout

Summarize:

- outcome
- fixes
- blockers
- next actions

---

## Success Criteria

- prerelease published OR
- repo is fully ready for prerelease
- full report produced
