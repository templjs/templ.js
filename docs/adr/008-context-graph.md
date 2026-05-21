---
id: adr-008
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-008: Context Graph Platform (N-AST, TS-first, Rust-ready)'
---

## Status

Accepted - March 2026

## Context

templjs now needs consistent semantic behavior across authoring and runtime features:

- Hover, go-to-definition, completion, diagnostics in VS Code
- Template rendering semantics in core
- Schema and input-data alignment
- Template extraction (reverse rendering) flows and validation

The current design mixes feature-specific resolvers and context heuristics. That makes behavior inconsistent across features and difficult to evolve as new schema or host-language scenarios are introduced.

We need a model where multiple independently valid ASTs/providers can contribute context without direct dependencies between providers.

## Decision

Adopt a **Context Graph Platform** with the following constraints:

1. **N-provider model**: Support N providers where N >= 1.
2. **Independent validity**: Each provider AST/model is independently valid and replaceable.
3. **No direct provider coupling**: Providers communicate only by publishing facts/edges through the context graph API.
4. **Profile-based specialization**: Text-location and editor semantics are implemented as profiles over a shared core model.
5. **TypeScript-first implementation**: Implement v1 in TypeScript to maximize delivery speed and integration with current packages.
6. **Rust-ready contract from day 1**: Public interfaces must remain stable and implementation-agnostic so the execution engine can move to Rust later.
7. **No dependency leakage in public API**: Public contracts must not expose third-party package symbols or types.
8. **Transport-open architecture**: Keep the contract transport-agnostic so future inter-process usage (for example protobuf, GraphQL, or IPC) can be added without breaking in-process consumers.
9. **Profile-first semantics**: `profile` is first-class in fact and query contracts.
10. **Query contract first, query language later**: v1 standardizes a versioned query contract; a standalone query language is explicitly deferred.

## Core Model

The context graph is a typed fact graph:

- **Subject**: opaque node or reference id
- **Predicate**: typed relationship/attribute key
- **Object**: value or reference id

Providers publish facts and relationships. Consumers query graph state and subscribe to graph deltas.

### Profile model

- A **profile** identifies semantic scope (for example `editor-location`, `runtime`, `extraction`, `schema`).
- Facts and edges are profile-scoped.
- Query contracts can filter by one or more profiles.

### Query model

- v1 defines a versioned, transport-agnostic query contract (`request` / `response`).
- Query results are deterministic and profile-aware.
- A separate textual query language is out of scope for v1.

This is an in-process architecture and intentionally excludes distributed-bus concerns (transport, service discovery, cross-process marshalling).

The model is intentionally transport-agnostic at the contract layer so optional inter-process adapters can be introduced later without changing core semantic contracts.

## Public API Rules

Public APIs in `@templjs/context-graph` must follow these rules:

1. Export only package-owned types/interfaces.
2. Export only JSON-serializable or primitive-based payload shapes.
3. Do not export third-party classes/generics/enums in signatures.
4. Keep ids opaque (`NodeId`, `EdgeId`, `ProviderId`, `ProfileId`).
5. Version all externally observable payload shapes.
6. Provide deterministic query ordering.
7. Do not encode transport-specific assumptions in core contracts.
8. Include profile scoping in fact and query contracts.
9. Standardize a versioned query request/response shape.

### Public type naming

The package name supplies the context namespace. Public graph-domain types should
therefore use concise package-owned names such as `Graph`, `Node`, `Edge`,
`Provider`, `Snapshot`, `Delta`, `Provenance`, and `WriteContext`.

Use qualifiers when they carry domain meaning or prevent ambiguity in consumer
code. Opaque ids keep their identity-domain prefixes (`NodeId`, `EdgeId`,
`ProviderId`, `ProfileId`), error contracts use explicit names (`ErrorCode`,
`ErrorPayload`, `OperationError`), the thrown error class is `GraphError`
because plain `Error` would collide with the platform type, and the query
contract keeps the `QueryRequest` / `QueryResponse` pair.

Do not add `Context*`, `Graph*`, or package-name prefixes only to repeat the
package namespace.

## Rust-Ready-from-Day-1 Checklist

1. **Stable wire contract**: Versioned payload schema for facts, queries, and deltas.
2. **Opaque identifiers**: No object-identity assumptions.
3. **Boundary purity**: No callbacks captured inside stored graph state.
4. **Serialization-safe values**: Restrict to JSON-compatible data at public boundary.
5. **Deterministic results**: Stable sorting for repeated identical queries.
6. **Error contract**: Structured error codes and payloads (avoid class-instance error dependence).
7. **Async boundary isolation**: Provider lifecycle and graph queries are interface-driven and runtime-agnostic.
8. **No dependency type leakage**: Public `.d.ts` remains free of external dependency symbols.

## Consequences

### Positive

- Aligns authoring/runtime semantics through a shared model.
- Enables incremental integration of new providers without cross-coupling.
- Keeps current TS velocity while preserving a future Rust migration path.
- Improves testability via deterministic graph snapshots and queries.
- Provides a shared semantic substrate for template extraction workflows.

### Negative

- Adds a new core platform package and migration effort.
- Requires phased refactors of Volar and server integrations.
- Introduces governance requirements for API boundary discipline.

### Neutral

- Future inter-process adoption remains an optional adapter concern and is explicitly out of immediate implementation scope.

## Implementation Plan (Phased)

1. Scaffold `@templjs/context-graph` package with strict API boundaries.
2. Implement minimal graph kernel + provider lifecycle + query interface.
3. Add first-class profile support in fact and query contracts.
4. Implement versioned query contract (`request` / `response`) in public API.
5. Add API boundary enforcement and contract tests.
6. Add Volar adapter and migrate hover/definition/completion reads.
7. Add diagnostics and schema-provider integrations.
8. Add extraction-provider integration points to support reverse-rendering workflows.
9. Evaluate performance; only then consider Rust engine replacement behind same API.
10. If needed later, add optional inter-process adapters (protobuf/GraphQL/IPC) behind unchanged contracts.

## Deferred

- A standalone query language (DSL) is deferred until concrete multi-consumer needs exceed the v1 query contract.

## References

- [docs/adr/003-vscode-architecture.md](docs/adr/003-vscode-architecture.md)
- [docs/adr/006-testing.md](docs/adr/006-testing.md)
- [docs/adr/010-semantic-layer-formalization.md](docs/adr/010-semantic-layer-formalization.md)
- [migration-plan.md](../../migration-plan.md)
- [backlog/047_template_extraction.md](backlog/047_template_extraction.md)
