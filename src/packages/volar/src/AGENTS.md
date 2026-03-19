---
id: volar-src-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: Volar Source Guardrails
summary: Guardrails for syntax-aware source changes inside @templjs/volar/src
---

You are editing source files under `src/packages/volar/src/`.

## Commands

- Focused semantic tests: `pnpm --filter @templjs/volar test -- test/diagnostic-provider.test.ts test/intellisense-provider.test.ts test/context-graph-adapter.test.ts`
- Custom delimiter end-to-end tests: `pnpm --filter @templjs/volar test -- test/custom-delimiters.e2e.test.ts`
- Build: `pnpm --filter @templjs/volar build`

## Parser Authority

- Treat `@templjs/core` lexer, parser, and semantic helpers as the authoritative source for template syntax.
- When a Volar feature needs loop bindings, statement metadata, alias declaration ranges, or delimiter-sensitive syntax semantics, add or reuse the missing capability in core first.
- Keep Volar logic thin: position mapping, Volar/LSP payload shaping, caching, and delegation to authoritative helpers.

## Standards

- Prefer one delimiter-aware parse or semantic-read path over multiple regex heuristics that re-interpret the same template text.
- Add regression tests for both default delimiters and at least one custom delimiter configuration whenever syntax-aware behavior changes.
- If a helper scans raw text, limit it to non-semantic tasks such as masking, offset preservation, or fast-path detection, and document that boundary in code.

## Boundaries

- ✅ Always: reuse shared core syntax helpers for scope resolution and statement semantics.
- ⚠️ Ask first: introducing a new raw-text scanner in Volar that interprets statement structure or alias semantics.
- 🚫 Never: add new regex-based template parsing in Volar for scope, alias, or statement-semantic decisions when the logic can live in core.
