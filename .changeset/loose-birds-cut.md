---
'@templjs/volar': patch
---

# Summary

Remove legacy schema-kind compatibility remapping inside the Volar context graph adapter so projection-native semantic kinds (`templjs.schema-path`, `templjs.schema-enum-value`) are used directly across snapshot and query flows.
