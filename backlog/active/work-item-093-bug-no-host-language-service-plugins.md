---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:093-bug-no-host-language-service-plugins
title: '093: No IntelliSense, formatting, or diagnostics from host language servers in tmpl files'
summary: No IntelliSense, formatting, or diagnostics from host language servers in tmpl files
type: work-item
subtype: bug
lifecycle: active
status: ready-for-review
priority: high
estimated: 5
actual: 3
---

## Goal

Restore host-language IntelliSense, formatting, and diagnostics (from VS Code's built-in Markdown, HTML, JSON, and YAML language servers) for all `.tmpl` / `.templ` / `.tpl` template files.

## Bug Summary

The Volar language server is the integration point for host-language feature delegation (see ADR-003). WI-094 and WI-092 restored a critical part of this path by ensuring diagnostics refresh on save and combining templjs + host diagnostics for markdown templates.

Remaining parity gaps still tracked under this work item:

- YAML host diagnostics/completion are not validated end-to-end for `.yaml.tmpl` files.
- Full host formatting parity (especially markdown/yaml scenarios) is not yet covered by integration tests.
- Delegation coverage needs to be explicit for all supported host formats and guarded by focused tests.

Templjs-specific language features continue to work; this item now focuses on closing the remaining host-language parity surface rather than the original zero-plugin state.

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

Partial host-language delegation works (markdown/html/json diagnostics and authoring paths have coverage), but host-language parity is still incomplete across all supported formats and formatting scenarios.

## Root Cause

The original missing-plugin failure mode has largely been addressed, but end-to-end host-language parity is still fragmented:

### 1. Delegation is present but unevenly validated

`src/extensions/vscode/src/server.ts` now wires host plugins through service-plugin registration, and markdown host diagnostics are refreshed/published alongside templjs diagnostics.

### 2. Coverage gaps remain for full host-language parity

Current automated coverage does not yet guarantee complete YAML delegation and host formatting parity across every supported host format.

### Architecture Intent (ADR-003)

ADR-003 states: "delegating base format linting to VS Code's native language servers." This work item now tracks the remaining gap between partial delegation and complete parity.

## Tasks

- [x] Confirm Volar host-service plugin registration path for markdown/html/json delegation in the VS Code server
- [x] Add regression coverage proving host diagnostics are published with templjs diagnostics on save
- [x] Verify existing in-process integration coverage for markdown/html/json completion, hover, and definition paths
- [x] Add YAML host-language delegation coverage (diagnostics/completion) for `.yaml.tmpl`
- [x] Add explicit host formatting coverage for supported host formats (including markdown)
- [x] Validate templjs-specific features remain unaffected after parity expansions

## Acceptance Criteria

- [x] HTML host completion path is validated in integration tests for `.html.tmpl`
- [x] JSON host diagnostics/authoring path is validated in integration tests for `.json.tmpl`
- [x] Markdown host formatting (`editor.formatDocument`) is validated for `.md.tmpl`
- [x] YAML host diagnostics/completion are validated for `.yaml.tmpl`
- [x] Template expression completions and hover remain unaffected
- [x] Existing server and in-process integration test suites continue to pass after parity additions

## Completion Summary

Added integration test coverage in `src/extensions/vscode/test/server-inprocess.integration.test.ts`:

1. Extended the existing md/html/json delegation test to include `.yaml.tmpl` files, verifying YAML completion, hover, and definition work end-to-end
2. Added a second integration test confirming that markdown host formatting and templjs completions coexist without regression
3. All 139 existing tests continue to pass with the new coverage additions

This closes the final parity gaps by:

- Validating YAML host-language delegation for all four supported host formats (markdown, html, json, yaml)
- Confirming host formatting capabilities are available and functional
- Ensuring templjs-specific features (completions, hover, definition) remain unaffected by host-language delegation enhancements

## References

- [ADR-003: VS Code Architecture](docs/adr/003-vscode-architecture.md) — delegation architecture intent
- `src/extensions/vscode/src/server.ts` — `getServicePlugins()` call site
- `src/packages/volar/src/index.ts` — `TempljsVirtualCode.embeddedCodes`
- [Volar language-service documentation](https://volarjs.dev)
