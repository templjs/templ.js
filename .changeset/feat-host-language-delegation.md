---
'templjs': minor
'@templjs/volar': minor
---

<!-- markdownlint-disable MD041 -->

feat(vscode): delegate host-language diagnostics via virtual document provider

Templated files now surface host-language diagnostics (e.g. markdownlint MD022,
remark, Vale, built-in linters) without hardcoding any specific tool.

A new `templjs-virtual://` scheme registers a `TextDocumentContentProvider` that
serves cleaned template content — template expressions replaced with
whitespace-preserving placeholders — under a virtual URI whose appended extension
(`.md`, `.json`, `.yaml`, `.html`, `.txt`) causes VS Code to activate whichever
language server the user already has configured.

`@templjs/volar` exports a new `cleanTemplateContent(source, delimiters?)` helper
that powers the cleaning pass, making the offset-mapping logic available to
downstream consumers.
