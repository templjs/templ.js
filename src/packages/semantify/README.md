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

## Integration Guidance

Projection contracts are the canonical integration path:

- build adapter output with stable spans and metadata,
- define semantic kinds and projection rules in profiles,
- execute helper extensions from projected graph/provenance facts.

Semantify core does not own editor-specific policy. Language-service and
domain clients should consume projected graph/provenance output and apply
feature policy in their own layers.
