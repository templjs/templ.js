---
id: wi-089
type: work-item
subtype: bug
title: '089: Validate host-language activation for templated Markdown extensions'
lifecycle: active
status: ready-for-review
priority: medium
estimated: 3
actual: 1
assignee: ''
test_results:
  - timestamp: 2026-03-27T00:00:00Z
    note: |
      Host-language activation matrix validation completed for `.md.templ`, `.md.tmpl`, and `.md.tpl`.
      Added regression coverage in VS Code extension and Volar tests to enforce deterministic behavior.
      Validation runs:
      - `pnpm --filter vscode-templjs test -- test/extension.test.ts test/server-inprocess.integration.test.ts` (28 passed)
      - `pnpm --filter @templjs/volar test -- test/index.test.ts` (55 passed)
links:
  depends_on:
    - '[[055_bug_no_md_lang_server_support]]'
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
