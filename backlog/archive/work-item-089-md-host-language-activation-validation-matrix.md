---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:089-md-host-language-activation-validation-matrix
title: '089: Validate host-language activation for templated Markdown extensions'
summary: Validate host-language activation for templated Markdown extensions
type: work-item
subtype: bug
lifecycle: inactive
status: closed
status_reason: completed
priority: medium
estimated: 3
actual: 1
completed_date: '2026-04-05'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/27
    - https://github.com/templjs/templ.js/pull/42
    - https://github.com/templjs/templ.js/pull/43
  evidence:
    - '[[record-089-md-host-language-activation-validation-matrix-evidence-1]]'
---

## Goal

Resolve remaining VS Code host-language recognition gaps for templated Markdown files and document deterministic validation outcomes for `.md.tpl`, `.md.templ`, and `.md.tmpl` local scenarios.

## Context

WI-055 delivered the core parity fixes (`.tpl.` marker inclusion, regression tests, grammar activation, and marker coverage), but local validation still reports host-language activation edge cases for templated Markdown variants.

## Scope

- Validate host-language activation behavior for `.md.tpl`, `.md.templ`, and `.md.tmpl` in local extension development host scenarios.
- Capture observed outcomes in a host-language activation validation matrix and identify mismatches versus expected Markdown language behavior.
- Implement and verify targeted fixes for unresolved recognition edge cases.

## Host-Language Activation Validation Matrix

- [x] `.md.tpl`
  - [x] Markdown grammar active
  - [x] Markdown diagnostics active
- [x] `.md.templ`
  - [x] Markdown grammar active
  - [x] Markdown diagnostics active
- [x] `.md.tmpl`
  - [x] Markdown grammar active
  - [x] Markdown diagnostics active

## Tasks

- [x] Reproduce current host-language activation behavior for `.md.tpl`, `.md.templ`, and `.md.tmpl` in local validation scenarios.
- [x] Complete the host-language activation validation matrix with observed grammar/diagnostic outcomes and root-cause notes.
- [x] Implement fixes for unresolved host-language recognition edge cases in VS Code extension/Volar integration.
  - Result: no runtime routing bug was found; the remaining gap was deterministic matrix regression coverage.
- [x] Add regression tests covering each extension variant against host-language activation expectations.
- [x] Re-run targeted VS Code extension and Volar tests and record evidence in `test_results`.

## Acceptance Criteria

- [x] Host-language activation validation matrix is fully populated for `.md.tpl`, `.md.templ`, and `.md.tmpl` scenarios.
- [x] Markdown grammar activation is confirmed for all three templated Markdown extension variants.
- [x] Markdown language diagnostics/linting are confirmed for all three templated Markdown extension variants.
- [x] Any remaining edge cases are either fixed with passing regression tests or documented with explicit blockers and follow-up plan.

## References

- [055_bug_no_md_lang_server_support.md](055_bug_no_md_lang_server_support.md)
- [src/packages/volar/src/index.ts](../src/packages/volar/src/index.ts)
- [src/extensions/vscode/test/server.test.ts](../src/extensions/vscode/test/server.test.ts)

## Relationships

- `depends_on`: [[work-item-055-bug-no-md-lang-server-support]]
