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
links:
  depends_on:
    - '[[054_bug_no_schema_aware_authoring]]'
---

## Goal

Ensure that `.md.tpl` files receive full markdown syntax highlighting and linting in VS Code, matching the behaviour already working for `.md.templ` files.

## Bug Summary

The Volar language plugin only recognises `.templ.` and `.tmpl.` as template markers. The `.tpl.` marker is absent, so `.md.tpl` files are never processed by the plugin. This silently disables both the embedded markdown TextMate grammar and delegation to the markdown language server.

## Reproduction Steps

1. Open a file named `sample.md.tpl` in the VS Code extension development host.
2. Write standard markdown content (headings, lists, code fences).
3. Observe no syntax highlighting for markdown constructs.
4. Observe no markdownlint or markdown language server diagnostics.

## Expected Behavior

- `.md.tpl` files receive markdown syntax highlighting via the `text.templjs.markdown` TextMate grammar.
- The markdown language server provides diagnostics and linting, matching `.md.templ` behaviour.

## Actual Behavior

- `.md.tpl` files open as plain text with no embedded markdown grammar activated.
- No markdown diagnostics are produced.

## Root Cause

`TEMPLATE_MARKERS` in [src/packages/volar/src/index.ts](src/packages/volar/src/index.ts#L49) is `['.templ.', '.tmpl.']` — `.tpl.` is missing, so `isTemplateFile` never matches `.md.tpl`.

## Tasks

- [ ] Add `.tpl.` to `TEMPLATE_MARKERS` in `src/packages/volar/src/index.ts`
- [ ] Verify `text.templjs.markdown` grammar activates for `.md.tpl` in the extension dev host
- [ ] Add a regression test asserting virtual document creation for `.md.tpl` input
- [ ] Confirm `pnpm run lint:frontmatter` passes

## Acceptance Criteria

- [ ] `.md.tpl` files show markdown syntax highlighting in VS Code
- [ ] Markdown linting diagnostics are produced for `.md.tpl` files
- [ ] Existing `.md.templ` and `.md.tmpl` behaviour is unaffected
- [ ] New regression test passes in CI
