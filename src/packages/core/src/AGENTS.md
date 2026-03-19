---
id: core-src-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: Core Source Guardrails
description: Guardrails for syntax-authority changes inside @templjs/core/src
---

You are editing source files under `src/packages/core/src/`.

## Commands

- Focused parser and semantic tests: `pnpm --filter @templjs/core test -- test/parser/parser.test.ts test/semantic/template-scopes.test.ts test/semantic/semantic-context.test.ts`
- Coverage check: `pnpm --filter @templjs/core test:coverage`
- Build: `pnpm --filter @templjs/core build`

## Project Knowledge

- `@templjs/core` owns the authoritative template syntax model for downstream consumers.
- Consumer-facing syntax helpers must support delimiter-aware behavior when IDE or language-server consumers rely on them.
- Downstream packages should adapt core metadata, not recreate equivalent parser logic with local regex heuristics.

## Standards

- When adding syntax-aware behavior, expose it from core in a reusable form before updating downstream consumers.
- Preserve or expose offset metadata needed by IDE consumers so they do not need post-hoc regex recovery.
- Add regression tests for both default and custom delimiters whenever a consumer-facing syntax helper changes.

## Boundaries

- ✅ Always: design core syntax helpers so Volar and VS Code can consume them directly.
- ⚠️ Ask first: breaking public parser or semantic helper contracts.
- 🚫 Never: hardcode default delimiters in new consumer-facing semantic helpers or require downstream packages to recover core-owned syntax metadata with regex parsing.
