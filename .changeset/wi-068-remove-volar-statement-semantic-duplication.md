---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
---

<!-- markdownlint-disable MD041 -->

Move remaining Volar statement-semantic parsing to shared `@templjs/core` helpers so diagnostics, completions, hover, and definition use one authoritative statement analysis path.
