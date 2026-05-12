---
id: adr-009
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-009: Adapter Runtime Manifest, Deferred Resolution, and Plugin Boundaries'
---

## Status

Accepted - May 2026

## Context

A quick markdownlint host-adapter PoC validated core feasibility:

- Extension-host and language-server IPC requests work.
- Subprocess invocation works and diagnostics can be remapped.
- Binary discovery can be delegated to host context.

The PoC also surfaced architectural and reliability gaps:

1. Cleaning-path inconsistencies can produce markdownlint false positives (for example MD012/MD009) when fallback behavior diverges from tokenizer semantics.
2. Tokenizer throw-on-unclosed-delimiter behavior forces a parallel regex fallback path (tracked by `work-item:105-tokenizer-error-tolerance-and-regex-fallback-elimination`).
3. Sporadic host crashes still require root-cause analysis (RCA), with hover path interactions a suspected contributor.
4. Domain leakage exists: markdownlint-specific runtime concerns are spread across extension and service-plugin layers.

Separately, the original architecture direction (message `c2ba5e8f-c16b-45fc-8a62-b24e60a2ea21`) established a staged protocol for scalable adapter runtime discovery:

- Declarative adapter self-description.
- Single host manifest request.
- Server-side activation planning.
- Deferred/lazy runtime resolution with cache tiers.

## Decision

Adopt an adapter-runtime architecture with explicit boundary ownership and staged resolution.

### 1. Adapter Manifest and Two-Phase Runtime Protocol

Use a manifest-first protocol as the standard server/extension contract:

1. `getAdapterManifest` (cheap, deterministic):

- adapter requirements (required/optional binaries, env keys, settings keys, capabilities)
- allowlisted settings snapshot
- allowlisted env snapshot
- cache/version token

1. `resolveAdapterRuntime` (deferred, targeted):

- server requests runtime resolution only for adapters relevant to active language/document context
- extension resolves binaries lazily with bounded concurrency and timeouts
- structured per-adapter failures (`binary_not_found`, `timeout`, `permission_denied`, `invalid_config`)

### 2. Caching Model

Use two cache tiers:

- Metadata cache (long-lived): keyed by adapter id + adapter version.
- Runtime resolution cache (short-lived): keyed by workspace + adapter id + PATH/env hash with explicit invalidation.

### 3. Ownership Boundaries

- `@templjs/core` owns syntax, tokenization, and whitespace-control semantics.
- `@templjs/volar` owns cleaning/mapping orchestration and delegates syntax semantics to core.
- `@templjs/language-service` owns language-specific adapter execution and diagnostics mapping.
- `src/extensions/vscode` owns transport, environment/settings acquisition, and command surfaces only.

No language-specific policy or semantic logic should remain in extension-host orchestration code.

### 4. Reliability Priority

Treat host crash RCA as first-class blocking reliability work. Complete RCA and stabilization before broad adapter expansion.

### 5. Syntax vs Semantics Layering Constraint

- Grammar/parser implementations are the source of truth for syntax structure only.
- Symbol introduction, scope lifetime, and name-resolution precedence must be expressed as declarative semantic mappings over parsed node kinds.
- Imperative semantic code is reserved for runtime-dependent concerns that declarative rules cannot express directly (for example schema-derived symbol sets or source-map offset translation).
- Local variable instances (scope bindings) and schema contract paths are distinct semantic concepts and must not be conflated.

## Consequences

### Positive

- Clear architecture for adding adapters without startup probe sweeps.
- Better diagnosability with structured failures and explicit adapter status.
- Reduced domain leakage through cleaner ownership boundaries.
- Lower startup latency through deferred resolution.

### Negative

- Requires protocol and cache lifecycle implementation work.
- Requires migration of current PoC wiring to boundary-compliant modules.
- Adds short-term coordination overhead across extension, server, and language-service packages.

### Neutral

- WI-105 remains the canonical path for tokenizer error tolerance and fallback elimination.

## Implementation Mapping

- Adapter manifest and deferred runtime resolution: `work-item:108-adapter-runtime-manifest-and-deferred-resolution`.
- Markdown cleaning/noise alignment while WI-105 progresses: `work-item:109-markdown-host-cleaning-noise-elimination`.
- Host crash RCA/stabilization: `work-item:110-language-server-host-crash-rca-and-stabilization`.
- Domain boundary consolidation: `work-item:111-language-domain-boundary-consolidation`.
- Tokenizer error tolerance + fallback elimination: `work-item:105-tokenizer-error-tolerance-and-regex-fallback-elimination`.

## References

- [docs/adr/003-vscode-architecture.md](docs/adr/003-vscode-architecture.md)
- [docs/adr/007-syntax-extensibility.md](docs/adr/007-syntax-extensibility.md)
- [docs/adr/010-semantic-layer-formalization.md](docs/adr/010-semantic-layer-formalization.md)
- [backlog/active/work-item-105-tokenizer-error-tolerance-and-regex-fallback-elimination.md](backlog/active/work-item-105-tokenizer-error-tolerance-and-regex-fallback-elimination.md)
