---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:091-bug-md-tmpl-wrong-grammar-scope
title: '091: md.tmpl files show no Markdown syntax highlighting (wrong grammar scope)'
summary: md.tmpl files show no Markdown syntax highlighting (wrong grammar scope)
type: work-item
subtype: bug
lifecycle: active
status: ready-for-review
priority: high
estimated: 1
actual: 1
links:
  pull_requests:
    - 'https://github.com/templjs/templ.js/pull/63'
  evidence:
    - '[[record-091-bug-md-tmpl-wrong-grammar-scope-evidence-1]]'
---

## Goal

Restore Markdown syntax highlighting for `.md.tmpl`, `.md.templ`, and `.md.tpl` files by correcting the TextMate grammar include scope in `injection-markdown.json`.

## Bug Summary

`injection-markdown.json` includes `source.gfm` (an Atom-ecosystem scope) as the embedded Markdown grammar. VS Code does not ship a grammar with that scope — the built-in Markdown grammar uses `text.html.markdown`. The silent miss means no Markdown constructs (headings, bold, links, fences) are highlighted at all. By contrast, the HTML grammar (`text.html.basic`) and JSON grammar (`source.json`) both use the correct VS Code-native scope names and work correctly.

## Reproduction Steps

1. Open the extension development host (`F5`).
2. Open any `*.md.tmpl` file.
3. Observe: no heading colouring, no bold/italic, no code fence highlighting — plain text only.
4. Compare with `*.html.tmpl` or `*.json.tmpl` — those show correct host-format highlighting.

## Expected Behavior

Markdown-format `.tmpl` files receive full Markdown syntax highlighting matching VS Code's built-in Markdown colourisation.

## Actual Behavior

Zero Markdown syntax highlighting. The file renders as plain text with only templjs expression tokens coloured.

## Root Cause

`src/extensions/vscode/syntaxes/injection-markdown.json` line 36:

```json
{ "include": "source.gfm" }
```

`source.gfm` is a GitHub Flavored Markdown scope from the Atom editor ecosystem. It does not exist in VS Code. VS Code's built-in Markdown grammar scope is `text.html.markdown`. The include silently produces no highlights.

## Fix Applied

Changed the include in `injection-markdown.json`:

```json
{ "include": "text.html.markdown" }
```

This matches the pattern used by all other injection grammars in this extension:

- HTML: `text.html.basic` ✓
- JSON: `source.json` ✓
- Markdown (fixed): `text.html.markdown` ✓

Extension rebuilt: `dist/server.js` 1.5 MB, `dist/extension.js` 790 KB.

## Tasks

- [x] Replace `source.gfm` with `text.html.markdown` in `injection-markdown.json`
- [x] Rebuild extension (`pnpm build` — all 5 projects succeeded)
- [x] Reload VS Code extension host and confirm Markdown highlighting in `*.md.tmpl`
- [x] Add regression test asserting grammar scope correctness for `.md.tmpl`

## Acceptance Criteria

- [x] `.md.tmpl`, `.md.templ`, and `.md.tpl` files display full Markdown syntax highlighting
- [x] No regression in `.html.tmpl` or `.json.tmpl` highlighting
- [x] Grammar injection test or snapshot validates `text.html.markdown` scope inclusion
- [x] `pnpm build` passes with zero errors

## Relationships

- `depends_on`: [[work-item-089-md-host-language-activation-validation-matrix]]
