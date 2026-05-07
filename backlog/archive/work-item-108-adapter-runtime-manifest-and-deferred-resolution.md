---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:108-adapter-runtime-manifest-and-deferred-resolution
title: '108: Adapter runtime manifest and deferred resolution protocol'
summary: Implement the two-phase adapter runtime protocol (manifest first, deferred runtime resolution second) with bounded probing and cache invalidation semantics.
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: high
estimated: 6
actual: 0
completed_date: '2026-05-07'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/88
  evidence:
    - '[[record:wi-108-merge-evidence-2026-05-07]]'
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

- [x] Document bin discovery resolution order from PoC learnings; verify independence from workspace/cwd presence.
- [x] Define language-server-agnostic adapter manifest types (binaries/env/settings/capabilities/contract).
- [x] Design manifest request/response interfaces for reuse across language servers.
- [x] Implement host-side manifest aggregation (extension transport layer only).
- [x] Implement server-side activation planner with no language-server-specific logic.
- [x] Add deferred runtime resolution endpoint for selected adapter IDs.
- [x] Implement runtime cache (workspace + adapter + hash keying).
- [x] Add invalidation triggers (workspace change, PATH/env change, settings change, manual refresh).
- [x] Add structured failure payloads and telemetry fields.
- [x] Add tests for planner behavior, cache invalidation, bin discovery order, and failure mapping.

## Deliverables

- Two-phase adapter runtime protocol in extension/server.
- Deterministic planner output and deferred resolution flow.
- Cache implementation with explicit invalidation.
- Automated tests and runtime status diagnostics.

## Acceptance Criteria

- [x] Server initialization does not block on full runtime probe sweeps.
- [x] Manifest responses are deterministic and bounded to allowlisted env/settings.
- [x] Runtime resolution is requested only for relevant adapters.
- [x] Cache invalidation works for all documented triggers.
- [x] Adapter failures are surfaced with structured failure types.
- [x] Build/test and frontmatter validation pass.
