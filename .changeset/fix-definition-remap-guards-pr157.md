---
'@templjs/language-service': patch
'@templjs/semantify': patch
---

<!-- markdownlint-disable MD041 -->

fix(language-service): guard definition remapping to same-document targets

Prevents definition remapping from rewriting cross-file target ranges. The
language-service now remaps definition target ranges only when the definition
`uri`/`targetUri` matches the source document URI, while still remapping
`originSelectionRange` for `LocationLink` payloads.
