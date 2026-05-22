---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/semantify': patch
'@templjs/language-service': patch
---

<!-- markdownlint-disable MD041 -->

fix: stabilize language-service and volar integration behavior

- restore URI-aware definition remapping boundaries for cross-document definitions
- tighten for-header hover/definition cursor boundary handling in volar
- align markdown diagnostics adapter typing for language-service build compatibility
