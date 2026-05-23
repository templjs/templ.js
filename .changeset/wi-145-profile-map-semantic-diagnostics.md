---
'@templjs/core': major
'@templjs/semantify': patch
'@templjs/cli': major
---

<!-- markdownlint-disable MD041 -->

Introduce structured syntax diagnostics in `@templjs/core` and canonical parse-phase naming (`lexical`, `parse`, `semantic`) for parser diagnostics.

Semantify now maps adapter syntax diagnostics into semantic diagnostics with explicit phase/origin metadata and marks strict runtime diagnostics as `projection`/`runtime`.

CLI validation now consumes core structured diagnostics and preserves user-facing error strings by formatting phase/message pairs.
