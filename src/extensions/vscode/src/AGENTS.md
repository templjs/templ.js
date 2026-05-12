---
id: vscode-src-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: VS Code Server Guardrails
description: Guardrails for syntax-aware changes inside src/extensions/vscode/src
---

You are editing source files under `src/extensions/vscode/src/`.

Also follow:

- `AGENTS.md` at the repository root
- `src/extensions/vscode/AGENTS.md` for extension-level packaging/release guardrails

## Commands

- Server tests: `rtk pnpm --filter vscode-templjs test -- test/server.test.ts test/server-inprocess.integration.test.ts`
- Build: `rtk pnpm --filter vscode-templjs build`

## Role

- The VS Code extension server is a transport and integration layer.
- It may load configuration, resolve workspace resources, cache document text, and map results to LSP payloads.
- It should not become a second implementation of template syntax semantics when shared Volar/core providers already own that behavior.

## Standards

- Forward syntax-aware authoring requests to shared providers instead of re-parsing template text in the server.
- If delimiter-related configuration is added here, pass it through to the authoritative Volar/core layers rather than interpreting template syntax locally.
- Keep tests focused on forwarding, integration, and end-to-end behavior rather than duplicating provider unit logic.

## Raw-Text Exception Contract

- `server.ts` and nearby transport modules must not derive loop aliases, iterable paths, or statement semantics from raw template source.
- Allowed raw-text operations are limited to transport concerns:
  - request/response payload mapping
  - URI/document routing
  - caching and lifecycle state
- Semantic authority remains in shared providers (core + Volar), including regressions for complex iterable headers.

## Boundaries

- ✅ Always: keep server logic limited to request plumbing, configuration, caching, and LSP response shaping.
- ⚠️ Ask first: adding server-side syntax interpretation beyond transport/integration needs.
- 🚫 Never: implement hover, definition, completion, or scope semantics in the server with ad hoc regex parsing of template text.
