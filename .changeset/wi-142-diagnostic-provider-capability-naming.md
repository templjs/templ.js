---
'@templjs/semantify': minor
'@templjs/volar': minor
---

<!-- markdownlint-disable MD041 -->

# WI-142 Diagnostic Provider Capability Naming

Cut over diagnostic helper capability naming from planner terminology to provider terminology.

- Rename helper kind `diagnostic-planner` to `diagnostic-provider` in semantify contracts and projector validation.
- Rename authoring helper id from `templjs.authoring.diagnostics` to `templjs.authoring.diagnostic-provider`.
- Rename Volar diagnostic source constant to provider wording and update related tests.
