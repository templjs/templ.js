---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:095-bug-syntax-highlighting-autocomplete-hover-not-working
title: '095: Syntax highlighting, autocomplete, and hover not working for host language in tmpl files'
summary: Syntax highlighting, autocomplete, and hover are absent for host-language content (YAML, Markdown, HTML, JSON) in tmpl files because the grammar embeddedLanguages mapping references scopes that are never emitted, and VS Code host-language delegation is not wired through Volar's virtual-code system
type: work-item
subtype: bug
lifecycle: active
status: ready-for-review
priority: high
estimated: 5
actual: 5
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/124
  evidence:
    - '[[record-20260514-223855-095-bug-syntax-highlighting-autocomplete-hover-not-working]]'
---

## Goal

Restore syntax highlighting, autocomplete, and hover for host-language content (YAML, Markdown, HTML, JSON) inside `.tmpl` / `.templ` / `.tpl` template files by correctly wiring VS Code's language-feature delegation through Volar's virtual-code and `embeddedLanguages` mechanism.

## Bug Summary

Opening a `.yaml.tmpl` file shows no YAML syntax highlighting, no YAML autocompletion, and no hover documentation for YAML keys. The same applies to `.md.tmpl` (Markdown), `.html.tmpl` (HTML), and `.json.tmpl` (JSON). TemplJS expression syntax (`{{ }}`, `{% %}`) is also not highlighted.

## Reproduction Steps

1. Install the extension and open the Extension Development Host.
2. Open any `.yaml.tmpl` file with valid YAML content and TemplJS expressions.
3. Observe: no YAML syntax colouring; TemplJS `{{ }}` blocks are not highlighted.
4. Place the cursor on a YAML key and trigger completions (`Ctrl+Space`). Observe: no YAML completions.
5. Hover over a YAML key. Observe: no hover documentation.
6. Repeat steps 2–5 for `.md.tmpl`, `.html.tmpl`, and `.json.tmpl`.

## Expected Behavior

- YAML, Markdown, HTML, or JSON content in `.tmpl` files is highlighted identically to the same content in a native `.yaml`, `.md`, `.html`, or `.json` file.
- TemplJS expression blocks (`{{ }}`, `{% %}`, `{# #}`) are highlighted with TemplJS-specific scopes on top of the host-language highlighting.
- Autocomplete and hover are provided by VS Code's configured language server for the host language (whatever the user has active for YAML/Markdown/HTML/JSON).

## Actual Behavior

No host-language syntax highlighting, autocomplete, or hover in any `.tmpl` file.

## Root Cause

Two compounding issues:

### 1. Grammar `embeddedLanguages` scope names are dead

Each injection grammar in `syntaxes/injection-*.json` simply delegates to the base scope via `"include": "source.yaml"` (etc.) without wrapping content in a `meta.embedded.block.*` scope. The `embeddedLanguages` entries in `package.json` map those wrapper scopes to language IDs:

```json
"embeddedLanguages": { "meta.embedded.block.yaml": "yaml" }
```

But since no token is ever assigned `meta.embedded.block.yaml`, VS Code's static language-feature routing via TextMate never fires. The mapping is entirely inert.

### 2. Volar virtual-code delegation to VS Code host servers is not wired

For LSP features (completions, hover, go-to-definition), VS Code routes requests from virtual codes to host language servers when the language client declares `embeddedLanguages` **and** the virtual code's language ID matches. The current language client configuration does not establish this routing, so requests for virtual code documents with `languageId: 'yaml'` never reach VS Code's YAML language server.

The in-process service plugins (`createYamlPlugin`, `createMarkdownPlugin`, etc.) partially compensate, but they embed library copies that cannot match VS Code's configured language server capabilities (markdownlint rules, YAML schema validation from the RedHat YAML extension, etc.).

## Resolution Strategy

Per the architectural decision recorded in WI-093: **delegate to VS Code's configured language servers for all host-language capabilities** rather than using in-process embedded libraries.

Concretely:

1. **Fix grammar files**: Wrap host-language content in `meta.embedded.block.<lang>` scopes so the `embeddedLanguages` mapping in `package.json` is live.
2. **Wire Volar virtual-code delegation**: Ensure the language client's `embeddedLanguages` declaration and the virtual code's `languageId` agree, so VS Code routes LSP requests for virtual code regions to the active host-language server.
3. **Scope in-process plugins to TemplJS-only**: Once delegation is working, the in-process service plugins should handle only TemplJS-specific intellisense; host-language features flow through VS Code's dispatch.

## Tasks

- [x] Audit each `syntaxes/injection-*.json` file: add `meta.embedded.block.<lang>` wrapper scopes so `embeddedLanguages` entries in `package.json` are live
- [x] Verify `source.templjs` grammar loads correctly and TemplJS expression scopes appear on top of host-language scopes
- [x] Confirm language client `embeddedLanguages` declaration matches emitted scope names
- [x] Investigate and wire Volar virtual-code delegation so VS Code routes LSP requests to host language servers for virtual code regions
- [x] Smoke-test syntax highlighting, autocomplete, and hover for all four host formats in the Extension Development Host
- [x] Add regression tests covering the delegation path end-to-end

## Acceptance Criteria

- [x] YAML content in `.yaml.tmpl` files is highlighted as YAML; TemplJS blocks are highlighted as TemplJS
- [x] Markdown content in `.md.tmpl` files is highlighted as Markdown; TemplJS blocks are highlighted as TemplJS
- [x] HTML content in `.html.tmpl` files is highlighted as HTML; TemplJS blocks are highlighted as TemplJS
- [x] JSON content in `.json.tmpl` files is highlighted as JSON; TemplJS blocks are highlighted as TemplJS
- [x] YAML completions and hover appear in `.yaml.tmpl` files (via VS Code's configured YAML language server)
- [x] Markdown completions and hover appear in `.md.tmpl` files (via VS Code's configured Markdown language server)
- [x] Existing templjs diagnostics and intellisense remain unaffected

## References

- `src/extensions/vscode/syntaxes/injection-yaml.json` — grammar missing `meta.embedded.block.yaml` wrapper
- `src/extensions/vscode/syntaxes/injection-markdown.json` — grammar missing `meta.embedded.block.markdown` wrapper
- `src/extensions/vscode/syntaxes/injection-html.json` — grammar missing `meta.embedded.block.html` wrapper
- `src/extensions/vscode/syntaxes/injection-json.json` — grammar missing `meta.embedded.block.json` wrapper
- `src/extensions/vscode/package.json` — `embeddedLanguages` entries that reference the dead scopes
- `src/extensions/vscode/src/extension.ts` — language client configuration
- [ADR-003: VS Code Architecture](docs/adr/003-vscode-architecture.md)

## Relationships

- `relates_to`: [[work-item-093-bug-no-host-language-service-plugins]]
- `relates_to`: [[work-item-091-bug-md-tmpl-wrong-grammar-scope]]
