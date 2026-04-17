---
name: release-triage
description: Use when packaging or prerelease publication fails and the blocker must be diagnosed and repaired quickly.
---

# Release Triage Skill

## Goal

Diagnose and repair release blockers quickly, with a bias toward packaging and metadata fixes over source-code churn.

## Diagnose In This Order

1. repository state issues
2. missing or invalid credentials
3. incorrect versions or prerelease strategy
4. missing package metadata
5. packaging include/exclude problems
6. broken release scripts
7. marketplace-specific constraints
8. true source-code defects

## Preferred Repair Order

1. docs and metadata
2. package scripts
3. packaging config
4. version alignment
5. narrow code fix required for packaging/build
6. stop and report if broader than release plumbing

## Common Checks

```bash
rtk git status
rtk pnpm build
rtk pnpm test
rtk npx vsce package --pre-release
rtk npm pack --dry-run
```

## Repair Policy

Automatically repair:

- missing metadata fields
- script wiring errors
- changelog/readme issues
- version mismatches
- packaging path errors
- missing included assets

Do not automatically repair:

- deep runtime bugs
- major test failures unrelated to packaging
- architecture-level problems

## Final Output

Always state:

- root cause
- exact fix made
- exact command rerun
- whether the blocker is resolved
- whether publish may proceed
