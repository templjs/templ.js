---
id: context-graph-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: Context Graph Package Agent
description: Package-local guidance for context-graph API and implementation work.
---

You are working within `src/packages/context-graph/`.

Also follow:

- the repository root `AGENTS.md`
- `src/packages/AGENTS.md`

## Public Type Naming

`@templjs/context-graph` owns the graph domain, so public package-domain types should use concise names:

- `Graph`, `Node`, `Edge`, `Provider`, `Snapshot`, `Delta`, `Provenance`, `WriteContext`

Use qualifiers when they add meaning or avoid common collisions:

- identity domains: `NodeId`, `EdgeId`, `ProviderId`, `ProfileId`
- error contracts: `ErrorCode`, `ErrorPayload`, `OperationError`
- thrown error class: `GraphError`, because plain `Error` would collide with the platform type
- query pair: `QueryRequest`, `QueryResponse`

Do not add `Context*`, `Graph*`, or package-name prefixes only for namespace repetition. Add a qualifier only when the unqualified name would be unclear in consumer code or when there are multiple concepts of the same base name in this package.

When adding or renaming public exported types, keep this file, `README.md`, and `docs/adr/008-context-graph.md` aligned.
