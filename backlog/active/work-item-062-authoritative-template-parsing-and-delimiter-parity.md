---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:062-authoritative-template-parsing-and-delimiter-parity
title: '062: Centralize authoritative template parsing and custom delimiter parity'
summary: Centralize authoritative template parsing and custom delimiter parity
type: work-item
subtype: epic
lifecycle: draft
status: proposed
status_reason: awaiting-approval
priority: high
estimated: 20
actual: 0
---

## Goal

Make one delimiter-aware core syntax pipeline the authoritative source for template scope bindings, statement metadata, and syntax-sensitive semantic decisions so Volar and the VS Code extension stop drifting through duplicated regex heuristics.

## Background

`@templjs/volar` currently mixes parser-backed expression analysis with raw-text regex parsing for loop headers, active statement discovery, and statement-level diagnostics/hover/definition behavior. That creates two kinds of drift:

1. Semantics drift for complex iterables and scoped paths.
2. Feature drift between default delimiters and custom delimiter configurations.

Concrete drift cases already observed during planning:

- `{% for item in users[activeIndex + 1] %}` can be truncated into `users[activeIndex` by regex-based scope logic, which then cascades into false undefined-variable diagnostics for both the iterable and `item.*`.
- `{% for item in users["full name"] %}` can be truncated at the first space inside the quoted index expression.
- Core already has parser-backed scope extraction, but the current helper is not a drop-in authority for IDE consumers because consumer-facing scope APIs do not yet centralize custom delimiter support and declaration-offset metadata.

This work item tracks the full refactor needed to make core authoritative, make Volar a consumer of that authority, and lock the rule in place with regression tests and nearby `AGENTS.md` guardrails.

## Scope

- Centralize syntax-aware template parsing in `@templjs/core`
- Thread custom delimiter support through the authoritative semantic helpers
- Replace regex-based statement/scope semantics in Volar with thin adapters over core
- Keep explicit exceptions for non-semantic raw-text scanning where a full parse is not required
- Add regression coverage demonstrating past and newly prevented drift cases
- Add local `AGENTS.md` guidance to prevent new non-authoritative parser logic from being added nearby

## Non-Goals

- Rewriting TextMate grammar files to avoid regex; TextMate grammars are regex-driven by design
- Forcing full-AST parsing onto every pure masking or position-preservation fast path where no syntax decision is made
- Changing public behavior unrelated to delimiter support, scope resolution, statement metadata, or IDE semantic responses

## Tasks

- [ ] Define the authoritative core API for delimiter-aware template scope and statement metadata.
- [ ] Extend core syntax helpers so consumer-facing semantic APIs accept custom delimiters and retain declaration-offset data needed by Volar.
- [ ] Replace `src/packages/volar/src/scope-resolution.ts` with a thin adapter over the core authority instead of raw-text regex parsing.
- [ ] Remove duplicated statement parsing heuristics from `src/packages/volar/src/diagnostic-provider.ts`.
- [ ] Remove duplicated statement parsing heuristics from `src/packages/volar/src/intellisense-provider.ts`.
- [ ] Audit `src/extensions/vscode/src/server.ts` and keep it limited to configuration, transport, caching, and LSP payload mapping only.
- [ ] Document the allowed raw-text exceptions for non-semantic scanning such as TextMate grammar, delimiter validation, and virtual-code masking/range preservation.
- [ ] Add comprehensive regression tests in core, Volar, and VS Code layers that demonstrate prior drift cases and prove parity for custom delimiters.
- [ ] Keep the new `AGENTS.md` guardrails up to date with the final authoritative API names and test commands.

## Deliverables

- A delimiter-aware core syntax authority that downstream packages consume instead of re-parsing template syntax independently
- A simplified Volar semantic path that delegates scope bindings and statement structure to core
- A VS Code server layer that forwards authoring requests without computing template semantics itself
- Regression suites covering default delimiters, custom delimiters, nested scopes, complex iterable expressions, and declaration-offset parity
- Guardrail `AGENTS.md` files near core, Volar, and VS Code authoring code

## Regression Matrix

### Core

- [ ] Add coverage in `src/packages/core/test/semantic/template-scopes.test.ts` for:
  - complex iterable expressions such as `users[activeIndex + 1]`
  - quoted bracket segments such as `users["full name"]`
  - filtered/parened iterable expressions where supported normalization is expected
  - custom delimiter variants for statements, expressions, and comments
- [ ] Add parser/lexer tests if new delimiter-aware metadata APIs require new token or AST guarantees.

### Volar

- [ ] Add coverage in `src/packages/volar/test/diagnostic-provider.test.ts` showing that complex `for ... in ...` headers no longer produce truncated iterable paths or false undefined-variable diagnostics.
- [ ] Add coverage in `src/packages/volar/test/intellisense-provider.test.ts` for statement hover, definition, and completion when the cursor is:
  - on the loop alias
  - inside a complex iterable expression
  - inside nested loops using outer aliases
  - inside custom-delimiter statements
- [ ] Add parity coverage in `src/packages/volar/test/context-graph-adapter.test.ts` so graph-backed scope resolution and Volar fallback resolution agree on the same bindings.
- [ ] Extend `src/packages/volar/test/custom-delimiters.e2e.test.ts` with at least one nested-loop case and one complex iterable case.

### VS Code

- [ ] Add or extend integration coverage in `src/extensions/vscode/test/server-inprocess.integration.test.ts` proving that the server forwards requests cleanly while authoritative scope/statement behavior comes from shared providers.
- [ ] Add one end-to-end definition or hover regression that would have failed under the prior regex drift behavior.

## Acceptance Criteria

- [ ] One delimiter-aware core API is the sole source of truth for template scope bindings and statement metadata used by Volar semantic reads.
- [ ] No Volar or VS Code source module uses free-form regex parsing over raw template text to answer scope, alias, or statement-semantic questions.
- [ ] Allowed exceptions for regex/raw-text scanning are explicitly documented and limited to non-semantic responsibilities.
- [ ] Default-delimiter and custom-delimiter behavior are covered by regression tests at core and Volar layers.
- [ ] Drift cases for spaced bracket expressions, computed indices, nested alias expansion, and custom delimiters are captured by tests and remain green.
- [ ] VS Code integration tests confirm the server stays a forwarding layer for semantic authoring behavior rather than a second parser implementation.

## Implementation Notes

- Prefer moving missing capabilities into `@templjs/core` before cleaning up downstream consumers. Volar should consume authoritative syntax metadata, not invent a second shape.
- If a fast path still needs scanning, use a deterministic delimiter-aware scanner with an explicitly non-semantic contract rather than open-coded regex heuristics that infer statement structure.
- Keep backward-compatible wrappers temporarily if needed, but mark them as adapters over core and remove duplicated parsing logic during the same work item.
- Treat custom delimiter parity as a first-class acceptance condition, not a follow-up polish item.

## Notes

- The planning guardrails added in nearby `AGENTS.md` files are intentionally narrow: they forbid new non-authoritative syntax parsing logic while still allowing raw-text utilities for masking, mapping, and TextMate grammar responsibilities.
- If this epic is accepted, it can be split into smaller implementation items, but every actionable slice should continue to roll up to this backlog entry.
