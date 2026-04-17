---
name: prerelease-publish
description: Prepare, validate, and execute prerelease workflows for npm packages and the VS Code extension using repository-native processes.
---

# Prerelease Publish Skill

## Goal

Drive the repository to a valid prerelease-ready or prerelease-published state using the documented release workflow, with minimal and safe changes.

## Core Rule

Always prefer the repository’s documented release process over ad hoc commands.

Do not introduce workflows that conflict with:

- changeset-based versioning
- CI/CD release pipelines
- documented release process

---

## When To Use

- "ship this tonight"
- prerelease publish requested
- release pipeline is blocked
- packaging/publish friction exists
- validating readiness before release

---

## Workflow

### 1. Preflight

```bash
rtk git status
rtk git branch --show-current
rtk pnpm -r list --depth 0
rtk cat docs/release-process.md
rtk cat docs/ci-cd.md
```

Identify:

- publishable npm packages
- VS Code extension target
- release method (CI vs local)
- required prerequisites

---

### 2. Install + Validate

```bash
rtk pnpm install
rtk pnpm build
rtk pnpm test
```

If repo defines narrower release validation commands → prefer those.

---

### 3. Package Validation

#### NPM packages

```bash
rtk npm pack --dry-run
```

Validate:

- included files
- exports
- package metadata
- no missing build artifacts

#### VS Code extension

```bash
rtk pnpm dlx @vscode/vsce package --pre-release
```

Validate:

- packaging success
- manifest correctness
- expected output artifact

---

### 4. Repair (Low-Risk Only)

Allowed:

- metadata fixes
- packaging includes/excludes
- script fixes
- changelog / README / release note fixes
- changeset creation (if missing)

Not allowed:

- major refactors
- architecture changes
- feature work

---

### 5. Versioning (CRITICAL)

Follow repo policy:

- use `pnpm changeset`
- do NOT use `npm version`
- do NOT edit version fields manually

If versioning is required:

- create or validate changesets
- ensure correct package selection
- ensure alignment of the 4 npm packages
- keep VS Code extension independent

---

### 6. Publish Strategy

Determine:

Is publishing:

- CI-driven (preferred)?
- manual?
- hybrid?

### NPM

- use repo-defined workflow
- prefer CI-triggered publish
- only use `npm publish` directly if consistent with repo policy

### VS Code

- prefer documented workflow
- use `vsce publish --pre-release` only if:
  - credentials exist
  - repo supports direct publish
  - CI is not required

---

### 7. Verify

Check:

- build success
- packaging success
- version readiness
- changeset presence
- publish success (if executed)
- dist-tags / extension state (if applicable)

---

## Reporting

Always produce:

### Summary

- what was attempted
- what succeeded
- what failed

### Commands run

### Files changed

### Artifacts

- npm packages (dry-run or published)
- VS Code extension package

### Versioning state

- changesets present?
- versions aligned?

### Publish result

- completed / partial / blocked

### Blockers

- exact issue
- why it matters

### Next action

- exact command or step a human should take
