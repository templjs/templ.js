---
id: how-to-doc-vader-app-maintainer-runbook
type: document
subtype: how-to
lifecycle: active
status: ready
title: Doc-vader GitHub App Maintainer Runbook
description: Exact maintainer steps used to create and wire the doc-vader GitHub App for protected-branch backlog sweep operations
---

## Purpose

This runbook documents the exact sequence used to create and operationalize the `doc-vader` GitHub App for backlog sweep writes to protected branches.

Use this when rotating credentials, recreating the app, or reapplying setup in another organization.

## What this enables

- `backlog-sweep` can push updates to protected long-lived branches
- pushes are performed through a GitHub App installation token rather than a user PAT
- repository rulesets can allow narrowly scoped app bypass where needed

## Prerequisites

- Organization-owner access to create and install GitHub Apps
- Admin access to repository rulesets in both:
  - `calan-co/doc-vader`
  - `templjs/templ.js`
- GitHub CLI authenticated with org-admin privileges

## App creation steps (authoritative sequence)

1. Create GitHub App under `calan-co`:
   - Name: `doc-vader`
   - Homepage URL: project homepage
   - Webhook: disabled
2. Set minimum permissions required by reusable workflows:
   - Repository `Contents`: `Read and write`
   - Repository `Pull requests`: `Read and write`
   - Keep all other permissions at least privilege unless required by future features.
3. Submit app and capture identifiers:
   - App ID (used later as repository variable)
4. Generate and download app private key (PEM):
   - Store securely in a password manager or secret vault
   - Track fingerprint for auditing
5. Make app public (required so external orgs can install it):
   - App settings -> Advanced -> Make public
6. Install app on `templjs` organization:
   - Installation target includes `templjs/templ.js`
   - Record installation ID for audit notes

## Repository configuration in templjs/templ.js

Configure the following in `Settings -> Secrets and variables -> Actions`.

### Required variable

- `DOC_VADER_APP_ID`
  - value: app ID from GitHub App settings

### Required secret

- `DOC_VADER_PRIVATE_KEY`
  - value: full PEM contents including begin/end lines

### Optional fallback secret

- `PACKAGES_READ_TOKEN`
  - only needed when default `GITHUB_TOKEN` cannot read upstream packages

## Workflow wiring in templjs/templ.js

The sweep job in `.github/workflows/backlog-automation.yml` passes app auth inputs into reusable `backlog-sweep`:

- `with.app-id: ${{ vars.DOC_VADER_APP_ID }}`
- `secrets.app-private-key: ${{ secrets.DOC_VADER_PRIVATE_KEY }}`

The reusable workflow in `calan-co/doc-vader` mints an installation token using `actions/create-github-app-token@v1` and uses that token for push operations.

## Ruleset bypass configuration

### templjs/templ.js

On the long-lived branch protection ruleset, add bypass actor:

- `actor_type: Integration`
- `actor_id: <doc-vader app id>`
- `bypass_mode: always`

This allows the app (not individual users) to push sweep updates where policy permits.

### Temporary policy relaxation during PR rescue (if needed)

During emergency merge recovery in `calan-co/doc-vader`, `require_last_push_approval` may be temporarily relaxed.

If changed, restore it immediately after merge completion.

## Recorded implementation values (2026-04-30)

The following values were used when this setup was first applied:

- GitHub App name: `doc-vader`
- GitHub App ID: `3558979`
- App owner org: `calan-co`
- Installation target org: `templjs`
- Installation ID on `templjs`: `128464633`
- PEM source path at setup time: `~/Downloads/doc-vader.2026-04-30.private-key.pem`
- PEM fingerprint: `SHA256:Hatj0BtGicPnoXLJ4Dq5vMPijRGLs2YpwSnGh4c6GAQ=`
- `templjs/templ.js` ruleset with app bypass: `13237327` (`protect-long-lived-branches`)

Temporary policy changes used during PR rescue in `calan-co/doc-vader` and then restored:

- Ruleset `15617339` (`Long-lived Branch Policy`)
- Ruleset `15617340` (`Staging Merge Method Policy`)

## Validation checklist

1. Confirm app credentials are present in `templjs/templ.js` Actions settings.
2. Run backlog automation sweep manually (`workflow_dispatch`, dry-run first).
3. Verify reusable workflow mints app token successfully.
4. Verify push to protected branch succeeds without user PAT.
5. Confirm no temporary ruleset relaxations remain.

## Operational commands used

Use `rtk` prefix for shell commands in this repository.

```bash
rtk gh api repos/templjs/templ.js/rulesets
rtk gh api repos/templjs/templ.js/rulesets/<RULESET_ID>
rtk gh api repos/templjs/templ.js/rulesets/<RULESET_ID> -X PUT --input ruleset.json
```

```bash
rtk gh api repos/calan-co/doc-vader/rulesets
rtk gh api repos/calan-co/doc-vader/rulesets/<RULESET_ID>
```

## Rollback plan

If app-based sweep pushes misbehave:

1. Disable backlog automation variable gate (`BACKLOG_AUTOMATION_ENABLED=false`)
2. Remove app bypass actor from ruleset
3. Rotate app private key and update `DOC_VADER_PRIVATE_KEY`
4. Re-run dry-run sweep before re-enabling
