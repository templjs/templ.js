---
id: adr-012
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-012: Composable Work-Item Workflow Profiles'
---

## Status

Accepted - June 2026

## Context

Work-item lifecycle validation previously depended on status rules inherited from the
shared frontmatter base schema. That coupled reusable work-item fields to one workflow
vocabulary and prevented consumers from composing the structure with their own statuses
or transitions.

Transition policy must remain declarative and reusable for documents whose state
dimensions differ from work items.

## Decision

Separate work-item structure, status definitions, status-conditioned policy, transition
management, and generated portable validation.

### 1. Workflow-neutral structure

[`schemas/work-management/contracts/work-item-structure.schema.json`](../../schemas/work-management/contracts/work-item-structure.schema.json)
owns reusable work-item frontmatter fields. It requires scalar `status` and permits a
scalar `status_reason`, but does not enumerate workflow-specific values.

The structure does not inherit `base/current.json#/$defs/core` or
`base/current.json#/$defs/lifecycleStatusCompatibility`, because those definitions
encode the repository-default status vocabulary.

### 2. Default status definitions

[`schemas/work-management/workflows/default/status-definitions.schema.json`](../../schemas/work-management/workflows/default/status-definitions.schema.json)
owns the repository-default statuses, reasons, categories, and connectivity classes.

### 3. Default status policy and entrypoint

[`schemas/work-management/workflows/default/status-policy.schema.json`](../../schemas/work-management/workflows/default/status-policy.schema.json)
owns repository-default lifecycle compatibility and status-conditioned work-item
requirements, including closure evidence.

[`schemas/work-management/frontmatter/work-item.json`](../../schemas/work-management/frontmatter/work-item.json)
remains the repository-default composition entrypoint. It composes the workflow-neutral
contract with the default status policy and closes the resulting object with
`unevaluatedProperties: false`.

Consumers can compose the workflow-neutral contract with a replacement policy schema
without inheriting repository defaults:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "/consumer/frontmatter/work-item.json",
  "type": "object",
  "unevaluatedProperties": false,
  "allOf": [
    {
      "$ref": "/work-management/contracts/work-item-structure.schema.json"
    },
    {
      "$ref": "/consumer/workflows/status-policy.schema.json"
    }
  ]
}
```

### 4. Transition profile

[`schemas/work-management/workflows/default/transition-profile.json`](../../schemas/work-management/workflows/default/transition-profile.json)
owns the repository-default transition rules. It references vocabulary enums through
schema IDs and JSON Pointer fragments.

The profile declares:

- source dimensions read from document JSON Pointer paths
- direct and dependent source-dimension domains
- required dependent-domain cases used to generate portable authored-field validators
- optional extension domains
- derived dimensions computed from lookup tables
- lookup-table value domains, defaults, and mappings
- transition rule precedence and allow-only rules

A consumer may reuse a status vocabulary with different transitions, or provide both a
replacement vocabulary and a replacement profile.

### 5. Portable instance validation

Standard JSON Schema cannot select a `$ref` dynamically from an instance's `status`
value. The generator materializes the portable `oneOf` branches from the transition
profile's dependent reason domains.

The checked-in generated schema is:

[`schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json`](../../schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json)

`pnpm run schemas:work-item-workflow:generate` updates it.
`pnpm run schemas:work-item-workflow:check` fails when it drifts. Frontmatter linting
runs the drift check, so pre-push and CI reject stale generated validation.

### 6. Semantic profile compilation

The transition-profile compiler validates relationships that standard JSON Schema
cannot express portably across separate schema documents.

The compiler verifies:

- schema references resolve through the configured registry to non-empty string enums
- dependent source-domain cases match the referenced dimension domain
- required dependent-domain cases exist
- derived dimensions reference existing dimensions and lookup tables
- lookup keys and values are valid for their status-scoped domains
- total lookup tables cover every declared input combination
- transition precedence and selectors reference configured dimensions and values

### 7. Evaluator boundary

The evaluator receives only resolved state vectors and transition rules.

It does not know about work items, frontmatter keys, statuses, reasons, categories, or
connectivities. Document-specific extraction and lookup behavior belongs to the
compiled profile resolver.

## Consequences

### Contributor edit map

- Change workflow-neutral work-item fields in
  `contracts/work-item-structure.schema.json`.
- Add or rename default statuses, reasons, categories, or connectivity classes in
  `workflows/default/status-definitions.schema.json`.
- Change default lifecycle compatibility or status-conditioned work-item requirements in
  `workflows/default/status-policy.schema.json`.
- Change default reason domains, derived mappings, or allowed transitions in
  `workflows/default/transition-profile.json`.
- Regenerate, but do not hand-edit,
  `workflows/default/generated/status-reason-compatibility.schema.json`.

### Positive

- Consumers can reuse work-item structure with alternate workflow vocabularies.
- Consumers can replace transition rules without changing work-item structure.
- Status-reason authoring remains scalar and ergonomic.
- Category and connectivity are derived consistently.
- Invalid profile cross-references fail during linter startup.
- Generated validation remains portable across standard JSON Schema consumers.

### Negative

- Profiles require semantic compilation in addition to JSON Schema shape validation.
- Vocabulary and lookup-table updates must remain aligned.
- Generated validation must remain checked in and current.

## References

- [schemas/work-management/frontmatter/work-item.json](../../schemas/work-management/frontmatter/work-item.json)
- [schemas/work-management/contracts/work-item-structure.schema.json](../../schemas/work-management/contracts/work-item-structure.schema.json)
- [schemas/work-management/workflows/default/status-definitions.schema.json](../../schemas/work-management/workflows/default/status-definitions.schema.json)
- [schemas/work-management/workflows/default/status-policy.schema.json](../../schemas/work-management/workflows/default/status-policy.schema.json)
- [schemas/work-management/workflows/default/transition-profile.json](../../schemas/work-management/workflows/default/transition-profile.json)
- [schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json](../../schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json)
- [schemas/work-management/support/transition-profile.schema.json](../../schemas/work-management/support/transition-profile.schema.json)
- [scripts/ci/generate-default-work-item-status-reason-compatibility.ts](../../scripts/ci/generate-default-work-item-status-reason-compatibility.ts)
- [scripts/ci/transition-profile.ts](../../scripts/ci/transition-profile.ts)
- [scripts/ci/state-transition-evaluator.ts](../../scripts/ci/state-transition-evaluator.ts)
