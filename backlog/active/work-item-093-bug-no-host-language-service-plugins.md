---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:093-bug-no-host-language-service-plugins
title: '093: No IntelliSense, formatting, or diagnostics from host language servers in tmpl files'
summary: No IntelliSense, formatting, or diagnostics from host language servers in tmpl files
type: work-item
subtype: bug
lifecycle: draft
status: proposed
status_reason: needs-triage
priority: high
estimated: 8
actual: 0
---

## Goal

Restore host-language IntelliSense, formatting, and diagnostics (from VS Code's built-in Markdown, HTML, JSON, and YAML language servers) for all `.tmpl` / `.templ` / `.tpl` template files.

## Bug Summary

The Volar language server is the integration point for host-language feature delegation (see ADR-003). In the current implementation, `getServicePlugins()` returns an empty array and `TempljsVirtualCode.embeddedCodes` is always an empty array. As a result:

- Markdown language server provides **no** diagnostics, no formatting, and no link suggestions for `.md.tmpl` files.
- HTML language server provides **no** tag completion, attribute hints, or formatting for `.html.tmpl` files.
- JSON language server provides **no** schema validation, key completion, or formatting for `.json.tmpl` files.
- YAML language server provides **no** diagnostics or completion for `.yaml.tmpl` files.

Only templjs-specific features (template expression completions, hover on filters/variables, template diagnostics) work. All host-format features are absent.

## Reproduction Steps

1. Open the extension development host.
2. Open `sample.html.tmpl`. Type `<div cl`. Observe: no `class` attribute completion from the HTML language server.
3. Open `sample.json.tmpl`. Introduce a JSON syntax error. Observe: no red underline from the JSON language server.
4. Open `sample.md.tmpl`. Observe: no "missing blank line before heading" or similar Markdown linting.

## Expected Behavior

Host-format language servers are active for embedded content, providing:

- Formatting (`editor.formatDocument`)
- Diagnostics (syntax errors, schema validation)
- Completions (tags, attributes, JSON keys, Markdown link targets)

## Actual Behavior

Zero host-language features. Only templjs expression features work.

## Root Cause

Two missing pieces in the Volar integration:

### 1. `getServicePlugins()` returns `[]`

`src/extensions/vscode/src/server.ts`:

```typescript
getServicePlugins() {
  return [];
}
```

Volar 2.x routes all host-language features through registered service plugins. With no service plugins registered, no host-language requests are processed.

### 2. `embeddedCodes` always empty

`src/packages/volar/src/index.ts` — `TempljsVirtualCode`:

```typescript
embeddedCodes: VirtualCode[] = [];
```

This array is never populated. For Volar to delegate to a host language server, the virtual code must emit embedded sub-documents with the correct `languageId` (e.g. `'html'`, `'markdown'`). The root virtual code already sets `languageId` to the correct host language, but without embedded code entries, Volar's language service pipeline has nothing to route.

### Architecture Intent (ADR-003)

ADR-003 states: "delegating base format linting to VS Code's native language servers." The current implementation does not fulfil this delegation.

## Tasks

- [ ] Investigate Volar 2.x service plugin API and which built-in plugins (html, json, markdown) are available via `@volar/language-service` or community plugins
- [ ] Implement or configure Volar service plugins for HTML, JSON, Markdown, and YAML
- [ ] Register host-language service plugins in `getServicePlugins()` in `server.ts`
- [ ] Populate `embeddedCodes` in `TempljsVirtualCode` with correctly mapped sub-documents per host format
- [ ] Verify that host-language `languageId` on embedded codes matches what the service plugins expect
- [ ] Add integration tests validating host-language feature delegation (completions, diagnostics, formatting) for each host format
- [ ] Confirm templjs-specific features continue to work after service plugin registration

## Acceptance Criteria

- [ ] HTML completion (`class`, `href`, `src`) works in `.html.tmpl` files
- [ ] JSON schema validation diagnostics appear in `.json.tmpl` files
- [ ] Markdown formatting (`editor.formatDocument`) works in `.md.tmpl` files
- [ ] YAML diagnostics appear in `.yaml.tmpl` files
- [ ] Template expression completions and hover are unaffected
- [ ] `getServicePlugins()` returns at least one plugin per supported host format
- [ ] `embeddedCodes` in `TempljsVirtualCode` populated with correctly mapped content for each host format
- [ ] All existing server tests continue to pass

## References

- [ADR-003: VS Code Architecture](docs/adr/003-vscode-architecture.md) — delegation architecture intent
- `src/extensions/vscode/src/server.ts` — `getServicePlugins()` call site
- `src/packages/volar/src/index.ts` — `TempljsVirtualCode.embeddedCodes`
- [Volar language-service documentation](https://volarjs.dev)

## Relationships

- `depends_on`: [[work-item-091-bug-md-tmpl-wrong-grammar-scope]]
- `depends_on`: [[work-item-092-bug-watchfileextensions-reversed-order]]
