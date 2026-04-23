---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:092-bug-watchfileextensions-reversed-order
title: '092: watchFileExtensions uses reversed extension order causing file-watch misses'
summary: watchFileExtensions uses reversed extension order causing file-watch misses
type: work-item
subtype: bug
lifecycle: active
status: ready
status_reason: prioritized
priority: medium
estimated: 1
actual: 1
links:
  evidence:
    - '[[record-092-bug-watchfileextensions-reversed-order-evidence-1]]'
---

## Goal

Ensure the Volar language server watches template files using the correct forward-order file extension suffixes, so file-change notifications reach the server for all supported `.md.tmpl`, `.html.tmpl`, `.json.tmpl`, etc. variants.

## Bug Summary

`server.ts` declared `watchFileExtensions` in reversed order (e.g. `.templ.md`, `.tmpl.json`) — the opposite of the actual file naming convention used throughout the codebase (`<base>.<marker>`, e.g. `sample.md.tmpl`). The Volar language server pattern-matches file-change events using these extensions. With reversed suffixes, the server never receives watch notifications for real template files, silently skipping incremental diagnostics refresh on save.

## Reproduction Steps

1. Open any `.md.tmpl` file in the extension development host.
2. Edit the file and save.
3. Observe: no diagnostics refresh triggered from the language server side (server's watch listener never fires).

## Expected Behavior

File-change events for `.md.tmpl`, `.html.tmpl`, `.json.tmpl`, `.yaml.tmpl`, `.yml.tmpl`, `.md.templ`, `.md.tpl` etc. are delivered to the language server and trigger diagnostics refresh.

## Actual Behavior

File-change events are silently dropped because the watch patterns (`.templ.md`, `.tmpl.json`, etc.) never match real file paths.

## Root Cause

`src/extensions/vscode/src/server.ts` — the `watchFileExtensions` array used reversed segments:

```text
'.templ.md', '.tmpl.md', '.tpl.md',    // wrong: reversed
'.templ.json', '.tmpl.json', ...
```

Correct form (base extension first, marker second):

```text
'.md.templ', '.md.tmpl', '.md.tpl',
'.html.templ', '.html.tmpl', ...
```

## Fix Applied

`watchFileExtensions` corrected to 15 forward-order suffixes:

`.html.templ`, `.html.tmpl`, `.html.tpl`, `.json.templ`, `.json.tmpl`, `.json.tpl`,
`.md.templ`, `.md.tmpl`, `.md.tpl`, `.yaml.templ`, `.yaml.tmpl`, `.yaml.tpl`,
`.yml.templ`, `.yml.tmpl`, `.yml.tpl`

Corresponding test expectation in `server.test.ts` updated to match. All 51 tests pass.

## Tasks

- [x] Correct `watchFileExtensions` array in `src/extensions/vscode/src/server.ts`
- [x] Update expectation in `src/extensions/vscode/test/server.test.ts`
- [x] Confirm all server tests pass (51/51)
- [x] Rebuild extension (`pnpm build`)
- [ ] Manual smoke test: save a `.md.tmpl` file and confirm diagnostics refresh

## Acceptance Criteria

- [ ] All 15 `watchFileExtensions` entries use forward-order notation `.<base>.<marker>`
- [ ] Language server watch test passes (`watchFileExtensions` expectation matches actual)
- [ ] No regression in existing server tests
- [ ] File save on any `.tmpl` / `.templ` / `.tpl` variant triggers server-side diagnostics refresh

## Relationships

- `depends_on`: [[work-item-089-md-host-language-activation-validation-matrix]]
