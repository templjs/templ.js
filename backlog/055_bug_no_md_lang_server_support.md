---
id: wi-055
type: work-item
subtype: bug
lifecycle: active
title: '055: Markdown syntax highlighting and linting not working for md.tpl files'
status: ready
priority: medium
estimated: 2
actual: 0
assignee: ''
commits:
  91b879c: 'fix(volar): add .tpl template marker and suffix file extension detection'
  f276da3: 'feat(vscode): add .tmpl language associations and YAML scalar tokenization'
  7389b0f: 'docs(backlog): update wi-055 with .tpl fix progress and follow-up note'
  b1a8438: 'docs(vscode): refresh supported template extensions'
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
- [ ] Verify `text.templjs.Markdown` grammar activates for `.md.tpl` in the extension dev host
- [x] Add a regression test asserting virtual document creation for `.md.tpl` input
- [x] Confirm `pnpm run lint:frontmatter` passes
- [x] Add unit test coverage for each template extension marker in `isTemplateFile` logic
- [x] Verify string scalars in frontmatter with `.md.tpl` extension are handled as a single token (previously failed due to missing template marker)

## Acceptance Criteria

- [ ] `.md.tpl` files show Markdown syntax highlighting in VS Code
- [ ] Markdown linting diagnostics are produced for `.md.tpl` files
- [ ] Existing `.md.templ` and `.md.tmpl` behaviour is unaffected
- [ ] New regression test passes in CI
- [ ] Unit tests cover all template markers in `isTemplateFile` logic
- [ ] String scalars in frontmatter with `.md.tpl` extension are tokenized as a single string token, not split by word boundaries

## Follow-up Note

- Revisit host-language activation: as of 2026-03-13, VS Code still does not reliably recognize Markdown host-language behavior for templ Markdown files in local validation, even after `.tpl`/`.tmpl` marker and extension association fixes.
