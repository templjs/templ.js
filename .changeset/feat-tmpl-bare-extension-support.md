---
'vscode-templjs': minor
---

<!-- markdownlint-disable MD041 -->

`.tmpl` and `.tpl` files (without a host-language prefix) are now recognised as TemplJS documents and handled by the language server. A dedicated document selector `{ pattern: '**/*.tmpl' }` is registered alongside the existing host-first patterns so that bare template files receive IntelliSense, diagnostics, and hover support.
