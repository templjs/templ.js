---
id: how-to-doc-vader-consumer-onboarding
type: document
subtype: how-to
lifecycle: active
status: ready
title: Doc-vader Consumer Onboarding Guide
description: README-style instructions for adding doc-vader backlog automation to a new repository or organization
---

## Overview

This guide explains how to add doc-vader backlog automation to a new repository or organization.

Target outcome:

- PR/workflow activity is ingested into backlog records
- sweep can apply eligible backlog transitions on protected branches
- credentials and branch policy remain least-privilege

## 1. Prerequisites

- Repository has a default long-lived branch strategy (for example `main` and `staging`)
- Admin access to repository Actions settings and branch rulesets
- Access to install the `doc-vader` GitHub App into your org/repo

## 2. Install the doc-vader GitHub App

1. Open the public `doc-vader` GitHub App install page.
2. Choose your target organization.
3. Select repositories (single repo or all repos based on policy).
4. Complete installation and capture app installation details for audit.

## 3. Configure repository credentials

In `Settings -> Secrets and variables -> Actions` for the target repo:

### Add variable

- `DOC_VADER_APP_ID`
  - app ID from `doc-vader` GitHub App settings

### Add secret

- `DOC_VADER_PRIVATE_KEY`
  - full PEM private key content

### Optional secret

- `PACKAGES_READ_TOKEN`
  - set only if the repo cannot read upstream packages with `GITHUB_TOKEN`

## 4. Add consumer configuration

Create `.doc-vader/backlog-consumer.json` in your repository.

Use the latest schema and examples from the doc-vader project docs before enabling automation.

## 5. Add workflow wiring

Add or update `.github/workflows/backlog-automation.yml` to call doc-vader reusable workflows.

Minimum sweep app-auth wiring:

```yaml
with:
  app-id: ${{ vars.DOC_VADER_APP_ID }}
secrets:
  app-private-key: ${{ secrets.DOC_VADER_PRIVATE_KEY }}
```

Recommended safety gate for sweep:

```yaml
if: >
  github.event_name == 'workflow_dispatch' &&
  vars.BACKLOG_AUTOMATION_ENABLED == 'true' &&
  (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging')
```

## 6. Configure branch/ruleset bypass for the app

On the repository ruleset protecting long-lived branches, add bypass actor:

- actor type: `Integration`
- actor id: doc-vader app ID
- bypass mode: `always`

Do not add broad user bypass when app bypass satisfies the requirement.

## 7. Enable incrementally

1. Set `BACKLOG_AUTOMATION_ENABLED=false` (or leave unset).
2. Run workflow dispatch dry-run.
3. Verify ingest outputs and no unauthorized writes.
4. Set `BACKLOG_AUTOMATION_ENABLED=true`.
5. Run a non-dry sweep and verify branch policy-compliant writes.

## 8. Verification checklist

- App installed in correct org/repo
- `DOC_VADER_APP_ID` variable present
- `DOC_VADER_PRIVATE_KEY` secret present
- Sweep job receives app-id and app-private-key
- Ruleset bypass includes app integration actor
- Dry-run passes
- Non-dry run writes successfully to protected branch

## 9. Troubleshooting

### Sweep cannot push to protected branch

- Verify app is installed on the target repository
- Verify ruleset bypass actor uses app ID and `Integration` actor type
- Verify private key is current and valid PEM

### Token minting fails

- Verify `DOC_VADER_APP_ID` matches the private key's app
- Rotate private key and update `DOC_VADER_PRIVATE_KEY`

### Reusable workflow cannot read package artifacts

- Add `PACKAGES_READ_TOKEN` with package read access
- Confirm token visibility policy covers the repository

## 10. Security notes

- Prefer app installation tokens over PATs
- Restrict sweep execution to protected branches
- Rotate app private keys periodically
- Keep bypass scoped to the app integration actor only
