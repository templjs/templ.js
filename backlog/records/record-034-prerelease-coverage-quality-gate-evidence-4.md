---
$schema: schemas/work-management/frontmatter/record.json
id: record:034-prerelease-coverage-quality-gate-evidence-4
title: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 4'
summary: '34: Pre-Release Coverage Quality Gate (ADR-006 Alignment) evidence 4'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.745Z

## Outcome

noted

## Observation

WI-034 remediation follow-up (strict thresholds retained):

- Added targeted branch coverage tests in VS Code extension/server/schema-loading suites
- Added targeted Volar helper/error-path tests for frontmatter-zone/service-plugin
- Re-ran package coverage after remediation:
  - `vscode-templjs`: All files 96.32/90.12/96.73/96.47 (package now passes strict target and per-file checks)
    - `src/extension.ts`: 98.58/90.00/97.05/98.58
    - `src/schema-loading.ts`: 92.46/90.27/100.00/92.38
    - `src/server.ts`: 98.52/90.00/94.44/99.00
  - `@templjs/volar`: All files remain 85.40/73.17/94.73/85.56 (still below ADR package targets)
  - `@templjs/cli`: All files 96.32/88.29/100.00/96.30, but per-file branch gaps remain in `render.ts`, `validate.ts`, `toml-parser.ts`, `xml-parser.ts`
  - `@templjs/core`: All files 96.30/91.31/99.41/96.50, but multiple per-file files remain below 95 branch/line targets
- Branch is still blocked at pre-push until core/cli/volar strict per-file failures are remediated

## Subject References

- [[work-item-034-prerelease-coverage-quality-gate]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/31>
- <https://github.com/templjs/templ.js/pull/32>
