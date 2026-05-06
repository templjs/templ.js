---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:106-remove-inprocess-yaml-service-and-delegate-to-volar-virtual-code
title: '106: Remove all in-process base-format language services and delegate atomically to VS Code'
summary: Delete yaml-language-service, frontmatter extraction, and all per-format in-process diagnostic paths from the extension host. The Volar plugin emits the full cleaned base-format content as a single atomic virtual document; VS Code routes it to whichever language server is registered for that extension.
type: work-item
subtype: task
lifecycle: active
status: ready
priority: high
estimated: 6
actual: 0
---

## Goal

Remove all in-process base-format language services from `src/extensions/vscode/src/extension.ts`. `TempljsVirtualCode` in `@templjs/volar` emits the cleaned source as a single atomic virtual document with the base format's language ID; VS Code routes it to whichever LSP-based language server is registered for that ID. No format-specific logic remains in the extension host.

## Background

### ADR-003 design contract

ADR-003 establishes that the extension strips template syntax from a `.tmpl` file and **delegates** the resulting virtual document to VS Code's native language server for the base format. The extension must not run its own language services for base-format content.

### Current violations

`extension.ts` currently runs two in-process services that belong to VS Code:

**In-process YAML (frontmatter):** imports `yaml-language-service`, extracts the `---` frontmatter block, cleans it, validates it, and merges results into `hostDiagnostics`.

**In-process Markdown (markdownlint):** imports `markdownlint/sync`, runs it against the cleaned full document text, and merges results into `hostDiagnostics`.

Both are wrong for the same reason: they use a different rule set, parser version, and configuration than whatever the user has installed. A user with a local `.markdownlint.json` that disables MD013 and enables custom rules sees the opposite behaviour from the bundled service. That misalignment produces false positives and false negatives — worse than no diagnostics at all.

### Why removal is the correct call, not an accepted gap

VS Code's extension-based linters (markdownlint, ESLint) activate on real file URIs using the extension host API. They do not see Volar virtual documents. Attempting to bridge them via shadow files re-introduces the timing fragility and suppressor hacks already abandoned. Attempting to bridge them via an in-process copy of the linter couples the extension to a specific tool's configuration API and version.

The correct behaviour is: **no diagnostics** from providers the user has not explicitly configured for `.tmpl` files. Silence is always preferable to diagnostics that contradict the user's configured rules.

### Ecosystem path: LSP-based linters

Any linter that ships as an LSP server (rather than a VS Code extension using `DiagnosticCollection`) is automatically available via Volar delegation with no changes to the templjs extension. For example, if a `markdownlint-lsp` LSP server is installed and registers itself for the `markdown` language ID, Volar routes the virtual document to it transparently. This is Option 1a — it is additive and requires no extension code changes; it works because Volar's delegation is language-ID-based and provider-agnostic.

## Scope

- `src/packages/volar/src/index.ts`: Verify (or correct) that `TempljsVirtualCode` emits the full cleaned base-format content as a single virtual document with the base format language ID and a complete source-map.
- `src/extensions/vscode/src/extension.ts`: Remove all of the following:
  - `createYamlService`, `computeFrontmatterYamlDiagnostics`, `toYamlValidationContent`, `extractMarkdownFrontmatter` (diagnostic use), `mapFrontmatterDiagnosticToSource`, `sourceToFrontmatterDiagnostics`
  - `computeMarkdownDiagnostics`, `toMarkdownlintContent`, `sourceToMarkdownDiagnostics`, the `markdownlint` import and all call sites
  - Shadow-file writing logic and the `.markdownlint.json` suppressor write
  - `publishDiagnosticsForSource` simplified to delegate-only: surface only what VS Code's language servers report via `getDiagnostics` on the virtual document URI, or remove `hostDiagnostics` entirely if Volar surfaces them automatically
- `src/extensions/vscode/package.json`: Remove `yaml-language-service` and `markdownlint` dependencies.
- `src/extensions/vscode/test/extension-host/diagnostics.test.js`: Replace in-process diagnostic assertions with assertions against diagnostics produced by the delegated language servers.

## Tasks

- [ ] Audit `TempljsVirtualCode` to confirm the full cleaned content is emitted as a single virtual document with the correct base-format language ID and a complete source-map; fix if not.
- [ ] Remove `computeFrontmatterYamlDiagnostics`, `createYamlService`, `toYamlValidationContent`, `extractMarkdownFrontmatter` (diagnostic path), `mapFrontmatterDiagnosticToSource`, and `sourceToFrontmatterDiagnostics` from `extension.ts`.
- [ ] Remove `computeMarkdownDiagnostics`, `toMarkdownlintContent`, `sourceToMarkdownDiagnostics`, and the `markdownlint` import from `extension.ts`.
- [ ] Remove the shadow-file writing and `.markdownlint.json` suppressor logic from `extension.ts`.
- [ ] Simplify or remove `publishDiagnosticsForSource`; confirm diagnostics flow correctly from the Volar virtual document to the source file's Problems panel entry.
- [ ] Remove `yaml-language-service` and `markdownlint` from the extension's `package.json` and rebuild.
- [ ] Confirm extension bundle size decreases.
- [ ] Update host-test assertions to reflect delegated language server diagnostics (or remove assertions that only tested in-process behaviour).
- [ ] Run `pnpm --filter @templjs/volar test` and `pnpm --dir src/extensions/vscode run test:host`.
- [ ] Create a changeset entry for `@templjs/volar` and `vscode-templjs`.

## Deliverables

- Extension host with no in-process base-format language services.
- `yaml-language-service` and `markdownlint` removed from the extension dependency tree.
- Confirmed correct virtual document delegation in Volar.
- Updated host-test assertions.
- Changeset entry.

## Acceptance Criteria

- [ ] No `yaml-language-service` or `markdownlint` import remains in `src/extensions/vscode/`.
- [ ] No `computeFrontmatterYamlDiagnostics`, `computeMarkdownDiagnostics`, or shadow-file logic remains in `extension.ts`.
- [ ] Diagnostics for `.tmpl` files in the Problems panel originate exclusively from Volar-delegated LSP language servers; no in-process service contributes diagnostics.
- [ ] No markdownlint or YAML diagnostics are emitted for `.tmpl` files unless the user has an LSP-based provider registered for the base-format language ID.
- [ ] Diagnostic positions in the Problems panel map correctly to source lines in the `.tmpl` file for LSP-sourced diagnostics.
- [ ] An LSP-based linter that registers for `markdown` (e.g., a hypothetical `markdownlint-lsp`) works automatically on `.tmpl` files with no extension code changes required.
- [ ] Extension bundle size is reduced (yaml-language-service and markdownlint removed).
- [ ] All `@templjs/volar` tests pass.
- [ ] Host diagnostics tests pass (in-process diagnostic assertions removed or replaced with LSP-delegation assertions).
- [ ] Adding a new base-format (e.g., `.html.tmpl`) requires zero changes to `extension.ts` (OCP satisfied).
- [ ] Lint and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-105-tokenizer-error-tolerance-and-regex-fallback-elimination]]
