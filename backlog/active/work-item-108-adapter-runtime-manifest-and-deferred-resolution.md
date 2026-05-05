---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:108-adapter-runtime-manifest-and-deferred-resolution
title: '108: Adapter runtime manifest and deferred resolution protocol'
summary: Implement the two-phase adapter runtime protocol (manifest first, deferred runtime resolution second) with bounded probing and cache invalidation semantics.
type: work-item
subtype: task
lifecycle: active
status: ready
priority: high
estimated: 6
actual: 0
---

## Goal

Implement a scalable, language-server-agnostic adapter runtime discovery protocol with deterministic bin discovery, deferred resolution, and explicit lifecycle management.

## Background

PoC iteration established bin discovery learnings and resolution order constraints:

- **Bin discovery** follows a specific resolution order (not tied to workspace/cwd presence)
- **Manifest-first protocol**: adapter self-description → single host manifest request → server-side planning
- **Deferred resolution**: runtime resolution happens on-demand, not at server startup
- **Language-server-agnostic interfaces**: all request/response types and planner contracts must be reusable across adapters
- **Client-side transport-only**: no language-server-specific logic in client/extension code

## Scope

- Define language-server-agnostic request/response interfaces for `getAdapterManifest` and `resolveAdapterRuntime`.
- Document bin discovery resolution order and its independence from workspace/cwd.
- Add extension-host manifest provider with env/settings allowlists (transport layer only).
- Add language-server planner for adapter activation states (server-side planning, no client logic bleeding in).
- Add deferred runtime resolution path with bounded concurrency/timeouts.
- Add runtime cache with explicit invalidation semantics.
- Add structured failure typing and telemetry.

## Tasks

- [ ] Document bin discovery resolution order from PoC learnings; verify independence from workspace/cwd presence.
- [ ] Define language-server-agnostic adapter manifest types (binaries/env/settings/capabilities/contract).
- [ ] Design manifest request/response interfaces for reuse across language servers.
- [ ] Implement host-side manifest aggregation (extension transport layer only).
- [ ] Implement server-side activation planner with no language-server-specific logic.
- [ ] Add deferred runtime resolution endpoint for selected adapter IDs.
- [ ] Implement runtime cache (workspace + adapter + hash keying).
- [ ] Add invalidation triggers (workspace change, PATH/env change, settings change, manual refresh).
- [ ] Add structured failure payloads and telemetry fields.
- [ ] Add tests for planner behavior, cache invalidation, bin discovery order, and failure mapping.

## Deliverables

- Two-phase adapter runtime protocol in extension/server.
- Deterministic planner output and deferred resolution flow.
- Cache implementation with explicit invalidation.
- Automated tests and runtime status diagnostics.

## Acceptance Criteria

- [ ] Server initialization does not block on full runtime probe sweeps.
- [ ] Manifest responses are deterministic and bounded to allowlisted env/settings.
- [ ] Runtime resolution is requested only for relevant adapters.
- [ ] Cache invalidation works for all documented triggers.
- [ ] Adapter failures are surfaced with structured failure types.
- [ ] Build/test and frontmatter validation pass.

## Relationships

- `depends_on`: [[work-item-103-vscode-client-thinning-and-wrapper-removal]]
