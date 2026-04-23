---
$schema: schemas/work-management/frontmatter/record.json
id: record:091-bug-md-tmpl-wrong-grammar-scope-evidence-1
title: '091: md.tmpl files show no Markdown syntax highlighting — grammar scope fix evidence 1'
summary: Grammar scope corrected in injection-markdown.json; extension rebuilt
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-22T00:00:00.000Z

## Outcome

passed

## Observation

Fix applied to `src/extensions/vscode/syntaxes/injection-markdown.json`:

```diff
- { "include": "source.gfm" }
+ { "include": "text.html.markdown" }
```

### Root Cause

`source.gfm` does not exist in VS Code. The built-in Markdown grammar scope is `text.html.markdown`.
Analogous working scopes in the same extension: `text.html.basic` (HTML) and `source.json` (JSON).

### Build Result

`pnpm build` — all 5 projects succeeded, zero errors:

- `dist/extension.js` 790.4 KB
- `dist/server.js` 1.5 MB

### Remaining Verification

Manual reload of the extension development host is required to confirm visual Markdown highlighting in `*.md.tmpl` files.
Regression coverage for markdown grammar scope and frontmatter anchoring is now present in `src/packages/volar/test/textmate-grammar.test.ts`.

## Subject References

- [[work-item-091-bug-md-tmpl-wrong-grammar-scope]]

## Artifact References

- `src/extensions/vscode/syntaxes/injection-markdown.json`
