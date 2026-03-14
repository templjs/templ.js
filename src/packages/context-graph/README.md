---
type: document
subtype: readme
lifecycle: active
title: '@templjs/context-graph README'
---

`@templjs/context-graph` provides dependency-agnostic contracts and a minimal in-process engine for context publication and querying.

## Design constraints

- N providers supported (N >= 1)
- Providers are independently valid and replaceable
- No direct provider-to-provider coupling
- Deterministic query ordering
- Public API is implementation-agnostic and dependency-leak-safe

## Public API rules

- Export package-owned types only
- Export JSON-compatible payloads and opaque ids
- Do not expose third-party dependency symbols in public signatures
