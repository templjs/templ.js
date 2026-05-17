---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/language-server': patch
---

<!-- markdownlint-disable MD041 -->

Share one schema source cache across language server service plugin initialization so repeated schema-backed requests can reuse loaded schema sources.
