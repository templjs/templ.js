---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
---

<!-- markdownlint-disable MD041 -->

Reuse shared schema metadata analysis in the Volar context graph adapter so repeated schema-backed completions and definition lookups avoid rebuilding equivalent metadata for the same schema object.
