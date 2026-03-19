---
id: wi-063
type: work-item
subtype: task
lifecycle: draft
title: '063: Colocate Tests with Primary Target Modules'
status: proposed
priority: high
estimated: 12
actual: 0
assignee: ''
---

## Goal

Refactor package test layout so each test file lives beside the source module it primarily validates, and reshape broad suites or source modules until each persistent test-to-module relationship is 1:1.

## Background

ADR-006, the repository structure guide, and package-level AGENTS guidance already describe co-located `*.test.ts` files as the preferred testing model. The current tree is inconsistent with that direction:

- Most tests still live in package-level `test/` directories
- Only a small number are already co-located under `src/`
- At least one suite (`template-scopes.test.ts`) currently exists in both `src/semantic/` and `test/semantic/`

This mixed layout makes ownership ambiguous, increases duplication risk, and makes module splits or renames harder because tests are not anchored to the source files they primarily protect.

## Scope

- Move unit- and module-focused tests in `src/packages/{core,cli,volar}` beside their owning source modules
- Split umbrella suites that currently cover several primary targets into module-specific files
- Refactor source modules when needed so a test suite can map cleanly to one primary implementation file
- Keep intentional integration or end-to-end coverage, but assign each suite an explicit owning entry module and colocate it accordingly
- Remove obsolete duplicate suites and stale helpers left behind by the migration

## Tasks

- [ ] Inventory current `*.test.ts` files in `src/packages/{core,cli,volar}` and map each to a primary target module
- [ ] Identify package-level suites that cover multiple modules and decide whether to split the tests, split the source module, or introduce a clearer owning orchestrator module
- [ ] Move module-focused suites from `test/` into colocated `src/**/<module>.test.ts` locations
- [ ] Rename tests and source modules where needed so the test filename and target module form an obvious 1:1 pair
- [ ] Consolidate shared test helpers and fixtures into module-local support files without recreating centralized catch-all suites
- [ ] Remove duplicate coverage, including redundant copies of the same behavioral suite in both `src/` and `test/`
- [ ] Update package documentation and contributor guidance anywhere the final layout differs from current examples
- [ ] Run affected package test suites and coverage checks to confirm the layout change does not reduce signal or break discovery

## Deliverables

- Co-located `*.test.ts` files adjacent to their primary modules across `@templjs/core`, `@templjs/cli`, and `@templjs/volar`
- Refactored source/test boundaries where a single suite currently spans multiple unrelated modules
- Removal or emptying of legacy package-level `test/` directories except for intentionally documented exceptions
- Updated documentation that describes the new test-placement rules and any allowed exceptions

## Acceptance Criteria

- [ ] Every maintained test file in `src/packages/{core,cli,volar}` has a single documented primary target module
- [ ] Module-focused tests are colocated with that target module as `*.test.ts` or in a module-local `__tests__/` directory if a sibling file is not practical
- [ ] No duplicate suite remains for the same primary behavior in both a package-level `test/` directory and a source-adjacent location
- [ ] Broad suites such as package catch-alls or multi-module unit files are split or backed by refactored source boundaries so each retained suite has a 1:1 module pairing
- [ ] Any intentional integration or end-to-end test that spans multiple files names its owning entry module and follows a documented placement rule
- [ ] `pnpm --filter @templjs/core test`, `pnpm --filter @templjs/cli test`, and `pnpm --filter @templjs/volar test` still pass after the migration
- [ ] Coverage remains at or above current package thresholds, with no loss caused by orphaned or undiscovered suites

## Implementation Notes

- Treat ADR-006 and package-level AGENTS guidance as the source of truth for the desired end state.
- Prefer colocating helper files near the modules they serve; only keep shared helpers centralized when multiple adjacent module suites genuinely depend on them.
- When a test currently validates a broad surface such as a barrel export or workflow entrypoint, either keep it attached to that explicit entry module or split the source surface until ownership is unambiguous.
- Avoid changing Vitest config solely to preserve old directory patterns; the goal is to simplify test discovery through layout rather than hide exceptions in configuration.

## Testing Strategy

- Migrate a small representative slice first to confirm discovery, watch mode, coverage, and editor integration continue to work with colocated suites.
- After the pattern is validated, complete the remaining moves package by package and rerun full package suites plus targeted integration coverage that exercises public APIs.
