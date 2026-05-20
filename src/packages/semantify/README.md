---
type: document
subtype: readme
lifecycle: active
title: '@templjs/semantify README'
---

![TemplJS logo](https://raw.githubusercontent.com/templjs/templ.js/refs/heads/main/assets/templjs.png)

`@templjs/semantify` provides projection-first semantic services. It accepts
normalized adapter output, applies profile projection rules, and emits
deterministic graph facts with provenance.

## Boundary

- Owns adapter/profile/projection contracts and Semantify runtime orchestration.
- Uses adapters to bridge source context implementations into normalized input.
- Uses profiles to define semantic kinds, projection rules, and optional helper
  extension metadata.
- Emits graph facts compatible with `@templjs/context-graph` primitives.
- Keeps editor affordances, domain resolution, diagnostics policy, and CI
  pass/fail rules outside Semantify core.

## Compatibility

The existing source-backed services remain available while projection-first
integration rolls out:

- `resolveContext`
- `resolveReferences`
- `planCandidates`

These compatibility APIs continue to use `@templjs/core` as syntax and binding
authority. New integrations should prefer adapter output plus profile projection
when reusable semantics and provenance are required.
