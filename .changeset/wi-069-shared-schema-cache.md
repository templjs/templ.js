---
'@templjs/core': patch
---

# Summary

Implement shared schema-analysis cache in SchemaValidator to enable metadata extraction and valid-path analysis reuse across validator instances, improving initialization performance for repeated compilations and hover/completion queries.
