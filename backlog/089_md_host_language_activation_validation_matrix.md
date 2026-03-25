---
id: wi-089
type: work-item
subtype: bug
lifecycle: draft
title: '089: Validate host-language activation for templated Markdown extensions'
status: proposed
priority: medium
estimated: 3
actual: 0
assignee: ''
links:
  depends_on:
    - '[[055_bug_no_md_lang_server_support]]'
  pull_requests:
    - 'https://github.com/templjs/templ.js/pulls?q=wi-089'
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

- [ ] `.md.tpl` (Pending local validation)
  - [ ] Markdown grammar active
  - [ ] Markdown diagnostics active
- [ ] `.md.templ` (Pending local validation)
  - [ ] Markdown grammar active
  - [ ] Markdown diagnostics active
- [ ] `.md.tmpl` (Pending local validation)
  - [ ] Markdown grammar active
  - [ ] Markdown diagnostics active

## Tasks

- [ ] Reproduce current host-language activation behavior for `.md.tpl`, `.md.templ`, and `.md.tmpl` in local validation scenarios.
- [ ] Complete the host-language activation validation matrix with observed grammar/diagnostic outcomes and root-cause notes.
- [ ] Implement fixes for unresolved host-language recognition edge cases in VS Code extension/Volar integration.
- [ ] Add regression tests covering each extension variant against host-language activation expectations.
- [ ] Re-run targeted VS Code extension and Volar tests and record evidence in `test_results`.

## Acceptance Criteria

- [ ] Host-language activation validation matrix is fully populated for `.md.tpl`, `.md.templ`, and `.md.tmpl` scenarios.
- [ ] Markdown grammar activation is confirmed for all three templated Markdown extension variants.
- [ ] Markdown language diagnostics/linting are confirmed for all three templated Markdown extension variants.
- [ ] Any remaining edge cases are either fixed with passing regression tests or documented with explicit blockers and follow-up plan.

## References

- [055_bug_no_md_lang_server_support.md](055_bug_no_md_lang_server_support.md)
- [src/packages/volar/src/index.ts](../src/packages/volar/src/index.ts)
- [src/extensions/vscode/test/server.test.ts](../src/extensions/vscode/test/server.test.ts)
