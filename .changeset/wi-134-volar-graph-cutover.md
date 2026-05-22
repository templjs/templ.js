---
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

Cut completion, hover, and definition read paths over to projection-backed graph adapters and scope binding helpers. This removes legacy Semantify candidate-planning dependencies from Volar intellisense while preserving alias, filter, and schema-path behavior with updated coverage.
