---
$schema: schemas/work-management/frontmatter/record.json
id: record:034-prerelease-coverage-quality-gate-evidence-3
title: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 3'
summary: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 3'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.744Z

## Outcome

noted

## Observation

WI-034 ADR alignment pass in cleanup branch (`cleanup/wi-034-coverage-gate`):

- Updated coverage thresholds to ADR-006 targets in root and package vitest configs
- Enabled `perFile: true` coverage enforcement across root, src workspace, and package configs
- Added `docs/coverage-strategy.md` to document threshold policy and remediation workflow
- Re-ran package coverage commands under new thresholds:
  - `@templjs/core`: All files 96.30/91.31/99.41/96.50 (fails per-file and package branch threshold 95)
  - `@templjs/cli`: All files 96.32/88.29/100.00/96.30 (fails per-file branch thresholds in render/validate/xml/toml parsers)
  - `@templjs/volar`: All files 85.30/72.57/94.73/85.45 (fails package-level ADR targets and multiple per-file checks)
  - `vscode-templjs`: All files 87.86/76.88/91.30/87.94 (fails package-level ADR targets and per-file checks)
- Gap closure remains in progress; failures are now surfaced deterministically by policy

## Subject References

- [[work-item-034-prerelease-coverage-quality-gate]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/32>
