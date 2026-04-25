---
'templjs': patch
---

<!-- markdownlint-disable MD041 -->

fix(vscode): surface YAML frontmatter parse errors for .md.tmpl files

Moves frontmatter validation out of the Volar `doValidation` path (unreachable
because `embeddedCodes` is always empty) into a direct `isMdTemplateUri` /
`collectFrontmatterDiagnosticsForText` path called unconditionally from
`publishDiagnosticsForDocument`.

Removes the YAML gray-matter check from `createMarkdownPlugin.provideDiagnostics`
in `service-plugins.ts` since it was never invoked via the Volar host pipeline.

Adds 7 unit tests covering both helpers. Updates `service-plugins.test.ts` to
remove the now-invalid YAML frontmatter test.
