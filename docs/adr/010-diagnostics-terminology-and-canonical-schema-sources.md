---
id: adr-010
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-010: Diagnostics Terminology and Canonical Schema Sources'
---

## Status

Accepted - May 2026

## Context

The diagnostics stack now has a stable post-cutover shape across `@templjs/core`,
`@templjs/semantify`, `@templjs/volar`, `@templjs/language-service`, and
`@templjs/language-server`.

During the cutover, compatibility aliases and migration-only helper names made the
public surface harder to reason about and caused terminology drift between source,
tests, and docs.

## Decision

Use canonical terminology only.

### 1. Canonical frontmatter schema keys

The supported schema source keys in frontmatter are:

- `$schema`
- `$content-schema`

Legacy variants such as `$templ-schema` and `$content_schema` are not part of the
final contract and must not be reintroduced in source, tests, or docs.

### 2. Canonical diagnostics terminology

- Syntax diagnostics originate from core parsing and template validation.
- Semantic diagnostics are the projection/runtime layer result after mapping syntax
  findings through profile rules.
- Diagnostic consumers should rely on the canonical phase/origin fields provided by
  the public record contracts rather than migration-only helper wrappers.

### 3. Contract ownership

- `@templjs/core` owns canonical frontmatter parsing and syntax facts.
- `@templjs/semantify` owns projection diagnostics and semantic record shaping.
- `@templjs/volar` and `@templjs/language-service` consume canonical helpers and must
  not reconstruct compatibility aliases locally.

## Consequences

### Positive

- Clearer diagnostics terminology across packages and documentation.
- No compatibility alias behavior to maintain in the final architecture.
- Less duplication between consumers and core parsing helpers.

### Negative

- Any downstream documents or fixtures that still rely on retired names must be
  updated to the canonical contract.

## References

- [docs/templjs-volar-target-architecture.md](../templjs-volar-target-architecture.md)
- [docs/adr/009-adapter-runtime-manifest-and-plugin-boundaries.md](./009-adapter-runtime-manifest-and-plugin-boundaries.md)
