---
type: document
subtype: readme
lifecycle: active
title: '@templjs/context-graph README'
---

![TemplJS logo](https://raw.githubusercontent.com/templjs/templ.js/refs/heads/main/assets/templjs.png)

`@templjs/context-graph` provides dependency-agnostic contracts and a minimal in-process engine for context publication and querying.

## Boundary

Context Graph owns graph primitives, provenance contracts, provider-scoped writes,
deterministic snapshots, and in-process query mechanics. It does not interpret
template, schema, editor, Linkity, or other semantic domains.

If consumers need richer traversal, persistence, or graph database behavior, that
should be introduced as an adapter around these contracts rather than expanded
into this package.

## Design constraints

- N providers supported (N >= 1)
- Providers are independently valid and replaceable
- No direct provider-to-provider coupling
- Deterministic query ordering
- Public API is implementation-agnostic and dependency-leak-safe
- Provenance can be carried as first-class graph fact lineage

## Public API rules

- Export package-owned types only
- Export JSON-compatible payloads and opaque ids
- Do not expose third-party dependency symbols in public signatures
- Keep semantic-domain meaning in providers, profiles, or downstream clients
