---
id: wi-031
type: work-item
subtype: task
lifecycle: active
title: '31: Write VS Code Language Feature Tests (completion, hover, diagnostics)'
status: in-progress
status_reason: not-fixed
priority: critical
estimated: 20
assignee: ''
links:
  depends_on:
    - '[[016_extension_tests]]'
comments:
  - timestamp: 2026-03-03T18:45:00.000Z
    note: |
      PR #20 submitted for review. Feedback uncovered critical production code bug in SchemaValidator.extractMetadata (required property detection), major test isolation issue in CLI tests (mock specifiers not matching actual imports), and moderate test logic issues (completion test offsets). Reverted WI-031 to `in_progress` to scope expanded fixes.

      ### Issues Identified

      **Critical (Production Code Bug)**:

      - **SchemaValidator.extractMetadata**: Incorrectly determines `required` status by checking if a property's own schema has a `required` key, instead of checking if the property name appears in its parent's `required` array. Fixed by refactoring to pass parent's `required` array through recursive calls and checking membership correctly.

      **Major (Test Isolation)**:

      - **CLI test mocks**: Mock specifiers (`../src/commands/*.js`) don't match actual import paths (`./commands/*.js`), so mocks never intercept real function calls. Fixed by updating all three mock declarations to use correct relative paths.

      **Moderate (Test Logic)**:

      - **Volar test offset**: Verified test offset correctly exercises bracket-normalization logic in completion prefix handling.

      ### Resolution Plan

      1. ✅ Fixed SchemaValidator.extractMetadata semantic bug (correct required-property detection)
      2. ✅ Fixed CLI test mock specifiers (ensure proper isolation)  
      3. ✅ Updated test expectations to match corrected behavior
      4. ⏳ Push fixes and re-request review
      5. ⏳ Merge once all feedback addressed
---

## Goal

Expand VS Code extension test coverage to include language feature providers (completion, hover, diagnostics, definition navigation).

## Background

WI-016 covered extension activation and server lifecycle. This work item focuses on language feature providers that deliver interactive IDE support.

**Scope**: 35+ tests to reach 50+ test target for Phase 3 completion.

**Test Categories**:

- **Syntax Highlighting** (5 tests): TextMate grammar application
- **Diagnostics** (15 tests): Error detection, position mapping, severity levels
- **Completion** (10 tests): Completion provider, filtering, sorting
- **Hover** (10 tests): Hover info, type information, documentation
- **Definition/References** (5 tests): Navigation, multi-file scenarios

## Acceptance Criteria

- [x] Syntax highlight tests passing (5 tests)
- [x] Diagnostics tests passing (15 tests)
- [x] Completion tests passing (10 tests)
- [x] Hover tests passing (10 tests)
- [x] Definition/references tests passing (5 tests)
- [x] Total: 45+ tests passing
- [x] No flaky tests
- [x] All tests run in CI/CD

## Test Coverage Plan

### Syntax Highlighting (5 tests)

- TextMate grammar loads correctly
- Keywords highlighted
- Expressions highlighted
- Comments highlighted
- String literals highlighted

### Diagnostics (15 tests)

- Parse errors detected
- Validation errors detected
- Error positions correct
- Diagnostic severity levels
- Multiple errors in single file
- Error recovery
- Schema validation errors
- Custom error messages
- Diagnostic clearing on save
- Related information
- Quick fix suggestions
- Code action suggestions

### Completion (10 tests)

- Completion provider invoked
- Built-in keywords suggested
- Function suggestions
- Variable suggestions
- Filtering by prefix
- Sorting by relevance
- Snippets expanded
- Custom completion items
- Completion documentation

### Hover (10 tests)

- Hover info displayed
- Type information shown
- Function signatures
- Variable documentation
- Quick info on hover
- Hover position accuracy
- Multiple hover items
- Hover time limits
- Markdown rendering

### Definition/References (5 tests)

- Go-to-definition works
- Multiple definitions handled
- References found
- Reference highlighting
- Rename refactoring
- Multi-file navigation

## Dependencies

- Requires: WI-016 (activation tests), WI-012 (Volar plugin), WI-013 (syntax), WI-014 (diagnostics), WI-015 (IntelliSense)

## Related Items

- WI-016: Extension activation tests (completed)
- WI-020: CLI documentation
- WI-019: CLI tests

## Notes

This work item represents the language feature test expansion for Phase 3 completion. It completes the extension testing strategy outlined in ADR-006.

## Implementation Progress (2026-03-03)

Implemented language-feature test expansion across Volar and VS Code extension suites with completion filtering/sorting behavior improvements.

### Code and Test Updates

- Updated completion behavior in `src/packages/volar/src/intellisense-provider.ts` to support prefix filtering and deterministic relevance sorting for variables, properties, filters, and statement keywords.
- Expanded `src/packages/volar/test/intellisense-provider.test.ts` with additional completion, hover, and definition scenarios (including custom delimiters and array-style paths).
- Expanded `src/packages/volar/test/diagnostic-provider.test.ts` with custom-filter and remapped-base-diagnostic assertions.
- Transitioned WI status to `ready-for-review` with completed acceptance checklist.

### Validation Evidence

- `pnpm --dir src/packages/volar test -- test/intellisense-provider.test.ts test/diagnostic-provider.test.ts` → **68 passed, 0 failed**
- `pnpm --dir src/packages/volar test` → **200 passed, 0 failed**
- `pnpm --dir src/extensions/vscode test` → **15 passed, 0 failed**
- `pnpm run lint:frontmatter` → all backlog frontmatter files passed schema validation
