---
id: rpt-001
type: document
subtype: report
lifecycle: active
status: ready
title: 'Backlog Alignment Report: ADR-009 and Adapter Architecture (WI-108 through WI-116)'
description: >
  Disposition of all 74 active backlog items against ADR-009 adapter runtime
  manifest and plugin boundaries, and work items WI-108 through WI-116.
---

**Date**: May 5, 2026  
**Reference**: ADR-009 and work items WI-108 through WI-116 (adapter runtime manifest, service-plugin contracts, language-specific adapters)

---

## Executive Summary

Of 74 active backlog items:

- **13 items** are directly aligned with new adapter architecture (WI-097 through WI-116)
- **18 items** are foundational/orthogonal work that can proceed in parallel
- **23 items** are optimization/infrastructure that should be deferred until adapter foundation stabilizes
- **15 items** require disposition clarification or scope adjustment
- **5 items** are small bugs that can be completed independently

---

## Critical Path: Foundation Required Before Broad Adapter Expansion

### Status: Ready / In-Progress / Ready-for-Review

These items establish the architectural foundation required by ADR-009.

| ID         | Title                                                                  | Status           | Disposition             | Rationale                                                                                                 |
| :--------- | :--------------------------------------------------------------------- | :--------------- | :---------------------- | :-------------------------------------------------------------------------------------------------------- |
| **WI-097** | Implement TemplJS Volar target architecture migration epic             | ready-for-review | **PROCEED**             | Stages WI-098-104 which are prerequisites for adapter architecture. Must be unblocked first.              |
| **WI-098** | Establish language-core contracts and boundary tests                   | ready-for-review | **PROCEED**             | Stage 1 of epic; establishes package-owned contracts required by adapter contract (WI-111).               |
| **WI-099** | Split language packages and migrate server/service/core entrypoints    | ready-for-review | **PROCEED**             | Stage 2; splits into language-service package where adapters live (WI-112-116).                           |
| **WI-100** | Replace root-only virtual code with root + embedded model              | ready-for-review | **PROCEED**             | Stage 3; virtual document structure needed for adapter output.                                            |
| **WI-101** | Move host-language services into language-server composition           | ready-for-review | **PROCEED**             | Stage 4; service composition must be ready before adapter instantiation.                                  |
| **WI-102** | Route semantics through core and context graph end-to-end              | ready-for-review | **PROCEED**             | Stage 5; context-graph authority required for adapter runtime planning decisions.                         |
| **WI-103** | Thin VS Code client and remove server-wrapper feature ownership        | ready-for-review | **PROCEED**             | Stage 6; extension = transport only (ADR-009). Prerequisite for clean adapter boundaries.                 |
| **WI-104** | Delete transitional code and finalize architecture acceptance evidence | ready-for-review | **PROCEED**             | Stage 7; final migration closure. Proceed after WI-103.                                                   |
| **WI-108** | Adapter runtime manifest and deferred resolution protocol              | ready            | **PROCEED IMMEDIATELY** | Implements two-phase protocol with language-server-agnostic interfaces (per ADR-009). Unblock WI-112-116. |
| **WI-111** | Define service-plugin contract and language-domain boundaries          | ready            | **PROCEED IMMEDIATELY** | Contract specification needed by all adapter implementations (WI-112-116).                                |
| **WI-109** | Fix whitespace control bug in markdown template cleaning               | ready            | **PROCEED (parallel)**  | Bug fix on core tokenizer/cleaning. Independent but complements WI-105.                                   |
| **WI-105** | Make tokenize() error-tolerant and eliminate Volar regex fallback      | ready            | **PROCEED (parallel)**  | Improves cleaning semantics (ADR-009 owns syntax in core). Reduces false positives.                       |
| **WI-110** | Language server host crash RCA and stabilization                       | ready            | **PROCEED IMMEDIATELY** | ADR-009 emphasizes host reliability before broad expansion. Blocker for production adapter use.           |

---

## Adapter Implementation Work (Depends on WI-111 contract)

### Status: Ready / Proposed

Requires WI-111 contract definition to begin implementation. Can parallelize after WI-111.

| ID         | Title                                                 | Status | Disposition            | Rationale                                                                        |
| :--------- | :---------------------------------------------------- | :----- | :--------------------- | :------------------------------------------------------------------------------- |
| **WI-112** | Markdown service-plugin adapter with runtime planning | ready  | **QUEUE AFTER WI-111** | Implements markdown adapter per contract. Depends on WI-111 and WI-108 protocol. |
| **WI-113** | YAML service-plugin adapter with runtime planning     | ready  | **QUEUE AFTER WI-111** | Implements YAML adapter per contract. Depends on WI-111 and WI-108 protocol.     |
| **WI-114** | HTML service-plugin adapter with runtime planning     | ready  | **QUEUE AFTER WI-111** | Implements HTML adapter per contract. Depends on WI-111 and WI-108 protocol.     |
| **WI-115** | JSON service-plugin adapter with runtime planning     | ready  | **QUEUE AFTER WI-111** | Implements JSON adapter per contract. Depends on WI-111 and WI-108 protocol.     |
| **WI-116** | Prettier service-plugin adapter with runtime planning | ready  | **QUEUE AFTER WI-111** | Implements Prettier adapter per contract. Depends on WI-111 and WI-108 protocol. |

---

## Bug Fixes & Quick Wins (Can Proceed Independently)

### Status: Ready / Ready-for-Review

Small, bounded issues that don't depend on architectural changes.

| ID         | Title                                                     | Status           | Disposition | Rationale                                       |
| :--------- | :-------------------------------------------------------- | :--------------- | :---------- | :---------------------------------------------- |
| **WI-037** | Normalize CRLF Offset Mapping in Volar Virtual Code       | ready            | **PROCEED** | Bug fix; independent of adapter work.           |
| **WI-041** | Guard Progress Percentage Against Zero-Byte File Division | ready            | **PROCEED** | CLI bug; independent of adapter work.           |
| **WI-042** | Add Test Coverage for Explicit XML Input Format Override  | ready            | **PROCEED** | Test coverage gap; independent of adapter work. |
| **WI-090** | Close TypeDoc Coverage Gap with Incremental Ratchet       | ready            | **PROCEED** | Documentation infrastructure; independent.      |
| **WI-096** | CI/local build drift for VS Code extension package        | ready-for-review | **PROCEED** | Build hygiene; independent.                     |

---

## Host Language Service Bugs (Clarification Required)

### Status: Ready / Ready-for-Review

These bugs are now scoped to adapter architecture. Need disposition clarification.

| ID         | Title                                                                                    | Status           | Disposition                                   | Rationale & Action                                                                                                                                                                                                                       |
| :--------- | :--------------------------------------------------------------------------------------- | :--------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-093** | No IntelliSense, formatting, or diagnostics from host language servers in tmpl files     | ready-for-review | **RECLASSIFY AS ADAPTER ACCEPTANCE CRITERIA** | This is now solved by adapter architecture (WI-112-116). After WI-111 contract is defined, reclassify as acceptance criteria for adapters rather than standalone item. Merge into WI-112-116 scope or close as "solved by architecture". |
| **WI-095** | Syntax highlighting, autocomplete, and hover not working for host language in tmpl files | ready            | **RECLASSIFY / MERGE**                        | Grammar mapping bug (lower priority now). After WI-111 contract, this should be acceptance criteria for adapter runtime planning. Consider merging into WI-111 or deferring to post-contract phase.                                      |
| **WI-106** | Remove all in-process base-format language services and delegate to VS Code              | ready            | **PROCEED (post WI-111)**                     | Aligns with ADR-009 ownership boundaries (vscode=transport only). Proceed after adapter protocol stabilizes to avoid conflicts.                                                                                                          |

---

## Infrastructure & Testing (Lower Priority - Defer Until Foundation Stable)

### Status: Proposed / Ready

These optimize codebase organization and testing but aren't blockers for adapter foundation. Defer until WI-098-104 and WI-111 stabilize.

| ID         | Title                                                                               | Status   | Disposition  | Rationale                                                                                                                             |
| :--------- | :---------------------------------------------------------------------------------- | :------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **WI-063** | Colocate Tests with Primary Target Modules                                          | proposed | **DEFER**    | Test refactoring; lower priority until adapter boundaries are clear. Moving tests during active architecture migration creates churn. |
| **WI-075** | Split Volar Context-Graph Adapter by Responsibility                                 | proposed | **DEFER**    | Splitting should align with adapter contract (WI-111). Risk of rework if done before contract is stable.                              |
| **WI-076** | Split Volar IntelliSense and Diagnostic Providers by Responsibility                 | proposed | **DEFER**    | Provider responsibility may change with adapter runtime planning. Defer until WI-111 contract is implemented.                         |
| **WI-077** | Split VS Code Server into Schema, State, and LSP Services                           | proposed | **DEFER**    | Restructuring should align with adapter boundaries and transport-only extension role (ADR-009). Defer.                                |
| **WI-078** | Co-Locate Core and Context-Graph Module Tests with Sources                          | proposed | **DEFER**    | Depends on WI-063 refactoring strategy. Defer.                                                                                        |
| **WI-079** | Co-Locate Volar and VS Code Module Tests with Sources                               | proposed | **DEFER**    | Depends on WI-063 and architectural finalization. Defer.                                                                              |
| **WI-080** | Rewrite CLI Tests Toward Behavior-First Public Workflows                            | proposed | **DEFER**    | Orthogonal but lower priority. Can follow after core work stabilizes.                                                                 |
| **WI-081** | Rewrite Volar and VS Code Tests Toward Behavior-First Request/Result Coverage       | proposed | **DEFER**    | Testing refactoring; lower priority until architecture stabilizes.                                                                    |
| **WI-082** | Remove Overlapping Test Coverage and Add Shared Semantic/Schema Fixtures            | proposed | **DEFER**    | Fixture consolidation depends on architecture clarity. Defer.                                                                         |
| **WI-083** | Document Benchmark Workflow, Semantic Ownership, Schema Cache, and Test Conventions | proposed | **DEFER**    | Documentation of final conventions should follow architecture stabilization (post WI-104).                                            |
| **WI-064** | Benchmark-First Repo Optimization Program                                           | ready    | **PARALLEL** | Measurement infrastructure can run independently but has lower priority than adapter foundation.                                      |

---

## Optimization & Long-Term Features (Deferred Pending Foundation Stability)

### Status: Proposed

These are valuable but not blockers for adapter architecture. Sequence after WI-111 and WI-112-116 stabilize.

| ID         | Title                                                        | Status      | Disposition                   | Rationale                                                                                                                             |
| :--------- | :----------------------------------------------------------- | :---------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **WI-056** | Context Graph Platform (N-provider semantic foundation)      | in-progress | **CONTINUE (lower priority)** | Orthogonal to adapters; provides semantic authority for runtime planning. Can continue but not critical path.                         |
| **WI-060** | Enforce exclusive context-graph hover/definition resolution  | in-progress | **CLARIFY**                   | Interaction with adapter runtime planning needs clarification. After WI-111 contract, determine if this constrains adapter authority. |
| **WI-067** | Extract Authoritative Core Statement and Expression Analysis | proposed    | **DEFER**                     | Core semantic consolidation; orthogonal to adapter architecture. Lower priority.                                                      |
| **WI-068** | Remove Remaining Volar Statement-Semantic Duplication        | proposed    | **DEFER**                     | Depends on WI-067. Defer.                                                                                                             |
| **WI-069** | Add Shared Schema Analysis Cache in Core                     | proposed    | **DEFER**                     | Schema optimization; orthogonal. Can follow after core work.                                                                          |
| **WI-070** | Adopt Shared Schema Analysis in Volar                        | proposed    | **DEFER**                     | Depends on WI-069. Defer.                                                                                                             |
| **WI-071** | Adopt Shared Schema Analysis in CLI                          | proposed    | **DEFER**                     | Depends on WI-069. Defer.                                                                                                             |
| **WI-072** | Adopt Shared Schema Analysis in VS Code Server               | proposed    | **DEFER**                     | Depends on WI-069. Defer.                                                                                                             |
| **WI-073** | Optimize Context-Graph Query Indexes and Ordering            | proposed    | **DEFER**                     | Query optimization; lower priority.                                                                                                   |
| **WI-074** | Reuse Query-Engine Builtin Registry and Metadata             | proposed    | **DEFER**                     | Query engine optimization; lower priority.                                                                                            |

---

## Long-Term / Future Features (Deferred - Out of Scope for Current Phase)

### Status: Proposed

These represent valuable future work but are lower priority than adapter foundation and can be sequenced after current architecture stabilizes.

| ID         | Title                                                                 | Status    | Disposition  | Rationale                                                                                    |
| :--------- | :-------------------------------------------------------------------- | :-------- | :----------- | :------------------------------------------------------------------------------------------- |
| **WI-023** | Support Alternative Syntax Themes (v1.1)                              | proposed  | **DEFER**    | Syntax extensibility feature; valuable but future work after core stability.                 |
| **WI-047** | Template Extraction Framework (Reverse Rendering)                     | proposed  | **DEFER**    | New feature (data extraction); independent of adapters. Queue for post-core-stability phase. |
| **WI-048** | Design Template Extraction Algorithm and API                          | proposed  | **DEFER**    | Depends on WI-047. Defer.                                                                    |
| **WI-049** | Implement Core Template Extraction Engine                             | proposed  | **DEFER**    | Depends on WI-048. Defer.                                                                    |
| **WI-050** | Add Schema-Guided Extraction and Validation                           | proposed  | **DEFER**    | Depends on WI-049. Defer.                                                                    |
| **WI-051** | Implement Extraction CLI Command                                      | proposed  | **DEFER**    | Depends on WI-049. Defer.                                                                    |
| **WI-052** | Write Extraction Tests and Documentation                              | proposed  | **DEFER**    | Depends on WI-051. Defer.                                                                    |
| **WI-061** | Support Multiple Built-in Filter Signatures                           | proposed  | **DEFER**    | Core semantic feature; valuable but lower priority.                                          |
| **WI-062** | Centralize authoritative template parsing and custom delimiter parity | proposed  | **DEFER**    | Core semantic consolidation; valuable but deferred.                                          |
| **WI-084** | Implement Template Render Whitespace Controls                         | completed | **ARCHIVED** | Already completed; no action needed.                                                         |
| **WI-085** | Structured Expression Parser AST Migration Epic                       | proposed  | **DEFER**    | Major expression parser refactoring; valuable but lower priority.                            |
| **WI-086** | Define Expression AST Contract and Semantic IR                        | proposed  | **DEFER**    | Depends on WI-085. Defer.                                                                    |
| **WI-087** | Implement Token-Driven Expression Parser Cutover                      | proposed  | **DEFER**    | Depends on WI-085. Defer.                                                                    |
| **WI-088** | Add Multi-Grammar Expression Overlay Support                          | proposed  | **DEFER**    | Depends on WI-087. Defer.                                                                    |

---

## ESM Migration (Infrastructure - Proceed in Parallel)

### Status: Ready

| ID         | Title                                                             | Status | Disposition                  | Rationale                                                                                                                                                 |
| :--------- | :---------------------------------------------------------------- | :----- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-107** | ESM server bundle migration spike results and phased path forward | ready  | **PROCEED (parallel track)** | Infrastructure work for deployment. Can proceed independently but should coordinate with WI-108 adapter protocol design to ensure bundling compatibility. |

---

## Sequencing Recommendation

### Phase 1: Foundation (Months 1-2)

**Goal**: Establish adapter architecture and contracts

1. Unblock **WI-097 (epic stages WI-098-104)**
   - Sequence: WI-098 → WI-099 → WI-100 → WI-101 → WI-102 → WI-103 → WI-104
   - Parallelizable: WI-109 (whitespace bug), WI-105 (tokenizer tolerance)
   - Also in parallel: WI-110 (host crash RCA)

2. Immediately after WI-099/WI-101 stabilize:
   - Implement **WI-108** (manifest protocol)
   - Implement **WI-111** (contract definition)

### Phase 2: Adapter Implementation (Months 2-3)

**Goal**: Implement all language-specific adapters

1. After WI-111 contract is stable:
   - Implement adapters in parallel: **WI-112, WI-113, WI-114, WI-115, WI-116**
   - Acceptance criteria: reclassify WI-093, WI-095 requirements into adapter scope

2. Completion gates:
   - All adapters meet contract requirements
   - Host crash RCA (WI-110) resolved
   - No regressions from WI-109, WI-105

### Phase 3: Polish & Quick Wins (Concurrent with Phases 1-2)

**Goal**: Complete independent work items

1. Proceed independently (no dependency blocking):
   - **WI-037, WI-041, WI-042** (bug fixes)
   - **WI-090** (TypeDoc coverage)
   - **WI-096** (CI drift)
   - **WI-064** (benchmarking infrastructure)
   - **WI-107** (ESM migration spike)

### Phase 4: Deferred (Post Foundation Stability)

- All items marked **DEFER** above should be reassessed once WI-104 (architecture migration closure) completes
- WI-056, WI-060 (context graph work) may be eligible to continue in parallel with Phase 3 if they don't conflict with adapter contract

---

## Key Risks & Mitigations

| Risk                                                                               | Impact                                         | Mitigation                                                                                     |
| :--------------------------------------------------------------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **WI-097-104 delays**                                                              | Blocks all adapter work; stretches timeline    | Unblock epic review immediately; provide concurrent review/feedback to author.                 |
| **WI-110 (host crashes) unresolved**                                               | Production unreliability; blocks adapter trust | Make crash RCA highest priority in parallel with epic. Do not ship adapters without stability. |
| **WI-111 contract ambiguity**                                                      | Rework risk in WI-112-116; design churn        | Invest in WI-111 clarity upfront; include adapter authors in contract review.                  |
| **Adapter scope creep (WI-112-116)**                                               | Timeline slips; quality issues                 | Define minimal viable adapter in WI-111; defer non-trivial features to Phase 3.                |
| **Test/infrastructure refactoring (WI-063, WI-075-079) during active development** | Merge conflicts; bisecting risk                | Enforce deferral; no test reorganization until WI-104 stabilizes.                              |

---

## Summary Counts

| Category                                          | Count  | Action                                                      |
| :------------------------------------------------ | :----- | :---------------------------------------------------------- |
| **Critical Path (must proceed)**                  | 13     | Proceed immediately; unblock WI-097 epic.                   |
| **Quick Wins (independent)**                      | 5      | Proceed in parallel; no blocking dependencies.              |
| **Phase 2 (adapter-specific, depends on WI-111)** | 5      | Queue after WI-111 contract ready.                          |
| **Parallel Infrastructure**                       | 2      | WI-056-060, WI-064, WI-107; assess post-Phase-1.            |
| **Defer Until Foundation Stable**                 | 23     | Block until WI-104 completes or WI-111 contract stabilizes. |
| **Long-Term Features**                            | 21     | Defer to post-Phase-2; reassess priority afterward.         |
| **Completed**                                     | 1      | Archive (WI-084).                                           |
| **Total**                                         | **74** |                                                             |
