---
$schema: schemas/work-management/frontmatter/record.json
id: record:040-cli-watch-mode-output-policy-evidence-1
title: '40: Honor Output Mode Flags (--json, --quiet) in Watch Mode evidence 1'
summary: '40: Honor Output Mode Flags (--json, --quiet) in Watch Mode evidence 1'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.750Z

## Outcome

noted

## Observation

Implemented mode-aware watch writers in CLI render flow:

- `--json --watch` now emits JSON envelopes for render success and errors
- `--quiet --watch` suppresses non-error output (including startup banner)
- `--verbose --watch` remains available for diagnostics
  Verification:
- `src/packages/cli/test/cli.test.ts` + `src/packages/cli/test/watch-mode.test.ts` (52 passed)
- Full CLI suite (247 passed)

## Subject References

- [[work-item-040-cli-watch-mode-output-policy]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/23>
- <https://github.com/templjs/templ.js/pull/42>
- <https://github.com/templjs/templ.js/pull/43>
