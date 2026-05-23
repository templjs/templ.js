---
'@templjs/core': major
'@templjs/language-core': major
'@templjs/semantify': major
'@templjs/volar': major
---

# WI-143 Semantic Zone Vocabulary Normalization

Normalize semantic zone vocabulary to canonical `metadata` and `content`
segments, and align downstream adapters/contracts to the unified zone model.

BREAKING: replaces legacy semantic zone contract values and field names
(`frontmatter`/`body`, `contextBlock`, `legacyContextBlock`, and
`resolveSemanticContextBlock`) with canonical `metadata`/`content` and
`segment` APIs.
