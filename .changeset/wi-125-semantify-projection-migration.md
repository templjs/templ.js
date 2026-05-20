---
packages:
  - '@templjs/core': minor
  - '@templjs/cli': minor
  - '@templjs/volar': minor
  - '@templjs/context-graph': minor
  - '@templjs/semantify': minor
  - '@templjs/language-service': minor
  - vscode-templjs: patch
---

# Semantify Projection Architecture Migration (WI-125 through WI-130)

Migrate Semantify and Context Graph to projection-first architecture with provenance contracts, adapter/profile model, and language-service integration.

## Changes

- **Context Graph**: Add graph primitives, provenance contracts, and deterministic snapshots (WI-126)
- **Semantify**: Add adapter/profile/projection contracts and runtime foundation (WI-127, WI-128)
- **TemplJS Profile**: Add template and schema adapters with reusable projection (WI-129)
- **Volar/Language Service**: Route semantic reads through projected output with profile helpers (WI-130)
- **VS Code Extension**: Update integration with new Semantify projection boundaries

All current authoring behavior preserved through compatibility adapters and integration tests.
