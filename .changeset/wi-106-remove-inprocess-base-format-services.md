---
'templjs': patch
---

<!-- markdownlint-disable MD041 -->

Remove all in-process base-format language services from the extension host (WI-106).

Deleted `yaml-language-service` (frontmatter YAML validation) and `markdownlint` (in-process MD linting) from `extension.ts`. Both violated ADR-003 by running a private copy of each tool with its own rule set and parser version, producing diagnostics that contradicted whatever the user had installed — false positives and false negatives.

The extension host now only keeps the virtual document provider in sync with open `.tmpl` files. VS Code routes `templjs-virtual://` documents to whichever LSP-based language server the user has registered for the base format language ID. Any LSP-based linter (e.g. a `markdownlint-lsp` server registered for `markdown`) works automatically via Volar's language-ID routing with no extension changes required (OCP satisfied).

Removed from `extension.ts`:

- `createYamlService`, `computeFrontmatterYamlDiagnostics`, `extractMarkdownFrontmatter`, `toYamlValidationContent`, `mapFrontmatterDiagnosticToSource`
- `computeMarkdownDiagnostics`, `toMarkdownlintContent`
- shadow-file writing, `.markdownlint.json` suppressor, `buildShadowUri`, `publishDiagnosticsForSource`, `hostDiagnostics`
- All hover/definition/formatting/completion providers that delegated via shadow files
- `yaml-language-service` and `markdownlint` npm dependencies

`initializeHostLanguageDelegation` simplified to virtual-document-provider registration and document sync only.
