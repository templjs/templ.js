---
id: wi-055
type: work-item
subtype: bug
lifecycle: active
title: '055: Markdown syntax highlighting and linting not working for md.tpl files'
status: in-progress
priority: medium
estimated: 2
actual: 2
assignee: ''
commits:
  91b879c: 'fix(volar): add .tpl template marker and suffix file extension detection'
  f276da3: 'feat(vscode): add .tmpl language associations and YAML scalar tokenization'
  7389b0f: 'docs(backlog): update wi-055 with .tpl fix progress and follow-up note'
  b1a8438: 'docs(vscode): refresh supported template extensions'
  13a7f34: 'fix(vscode): reload schema-aware diagnostics on schema file changes (WI-054, WI-055)'
test_results:
  - timestamp: 2026-03-22T00:00:00Z
    note: |
      Follow-up parity fix and verification:
      - Added `.tpl.*` variants to language server watched template extension list
      - Updated extension README extension coverage and configuration notes
      - Validation runs:
        - `src/extensions/vscode/test/server.test.ts` (41 passed)
        - `src/extensions/vscode/test/server-inprocess.integration.test.ts` (5 passed)
        - Full VS Code extension test set (80 passed)
links:
  depends_on:
    - '[[054_bug_no_schema_aware_authoring]]'
---

## Goal

Ensure that `.md.tpl` files receive full Markdown syntax highlighting and linting in VS Code, matching the behaviour already working for `.md.templ` files.

## Bug Summary

The Volar language plugin only recognizes `.templ.` and `.tmpl.` as template markers. The `.tpl.` marker is absent, so `.md.tpl` files are never processed by the plugin. This silently disables both the embedded Markdown TextMate grammar and delegation to the Markdown language server.

## Reproduction Steps

1. Open a file named `sample.md.tpl` in the VS Code extension development host.
2. Write standard Markdown content (headings, lists, code fences).
3. Observe no syntax highlighting for Markdown constructs.
4. Observe no Markdownlint or Markdown language server diagnostics.

## Expected Behavior

- `.md.tpl` files receive Markdown syntax highlighting via the `text.templjs.Markdown` TextMate grammar.
- The Markdown language server provides diagnostics and linting, matching `.md.templ` behaviour.

## Actual Behavior

- `.md.tpl` files open as plain text with no embedded Markdown grammar activated.
- No Markdown diagnostics are produced.

## Root Cause

`TEMPLATE_MARKERS` in [src/packages/volar/src/index.ts](src/packages/volar/src/index.ts#L49) is `['.templ.', '.tmpl.']` — `.tpl.` is missing, so `isTemplateFile` never matches `.md.tpl`.

## Tasks

- [x] Add `.tpl.` to `TEMPLATE_MARKERS` in `src/packages/volar/src/index.ts`
- [x] Verify `text.templjs.Markdown` grammar activates for `.md.tpl` in the extension dev host
- [x] Add a regression test asserting virtual document creation for `.md.tpl` input
- [x] Confirm `pnpm run lint:frontmatter` passes
- [x] Add unit test coverage for each template extension marker in `isTemplateFile` logic
- [x] Verify string scalars in frontmatter with `.md.tpl` extension are handled as a single token (previously failed due to missing template marker)

## Acceptance Criteria

- [x] `.md.tpl` files show Markdown syntax highlighting in VS Code
- [x] Markdown linting diagnostics are produced for `.md.tpl` files
- [x] Existing `.md.templ` and `.md.tmpl` behaviour is unaffected
- [x] New regression test passes in CI
- [x] Unit tests cover all template markers in `isTemplateFile` logic
- [x] String scalars in frontmatter with `.md.tpl` extension are tokenized as a single string token, not split by word boundaries

## Follow-up Note

- Revisit host-language activation: as of 2026-03-13, VS Code still does not reliably recognize Markdown host-language behavior for templ Markdown files in local validation, even after `.tpl`/`.tmpl` marker and extension association fixes.
