---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/semantify': patch
---

<!-- markdownlint-disable MD041 -->

Bootstrap tracked `@templjs/semantify` sources and wire Volar intellisense local-alias completions through canonical semantify services (`resolveContext`, `resolveReferences`, `planCandidates`) with focused tests.
