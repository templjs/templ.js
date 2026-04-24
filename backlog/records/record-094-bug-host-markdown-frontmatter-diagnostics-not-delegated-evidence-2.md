---
$schema: schemas/work-management/frontmatter/record.json
id: record:094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-2
title: '094: YAML frontmatter validation implementation evidence 2'
summary: gray-matter YAML frontmatter validation added to createMarkdownPlugin; 3 focused tests pass
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-24T00:00:00.000Z

## Outcome

passed

## Observation

### Changes

Two source files modified to deliver real YAML frontmatter diagnostics:

**`src/extensions/vscode/src/server.ts`**

- `collectHostDiagnosticsForDocument` cleaned up: removed overly defensive cast
  `(languageService as { doValidation?: (uri: string) => unknown })?.doValidation`.
- Now calls `project.getLanguageService().doValidation(uri)` directly; errors are caught
  and logged, returning `[]` on failure.

**`src/extensions/vscode/src/service-plugins.ts`**

- Added imports: `Diagnostic` type from `@volar/language-service`; `matter` from `gray-matter`.
- Extended `createMarkdownPlugin.provideDiagnostics` with a YAML frontmatter parse block:
  - Detects `---` frontmatter via `content.startsWith('---')`.
  - Calls `matter(content)` — throws `YAMLException` for invalid YAML.
  - Extracts `mark.line` (0-based document line) and `mark.column` from the exception.
  - Pushes a `Diagnostic` with `source: 'markdown'`, `code: 'md.frontmatter.yaml'`,
    `severity: 1` (Error).
  - Result merged with `computeDiagnostics` link diagnostics.

**Why `gray-matter`, not `vscode-markdown-languageservice`:**
`vscode-markdown-languageservice.computeDiagnostics` is a link-checker only; it cannot detect
YAML parse errors or heading-style violations. `gray-matter` (already a declared dependency,
version 4.0.3) provides YAML parse error detection with accurate line/column information.

**Scope boundary — `#Bad heading` style violations:**
These are NOT covered by this fix. `vscode-markdown-languageservice` does not lint heading
style, and markdownlint integration is out of scope for this work item.

### Test Coverage

New test file: `src/extensions/vscode/test/service-plugins.test.ts`

Three focused unit tests exercising `createMarkdownPlugin.provideDiagnostics` directly:

1. `returns a YAML frontmatter diagnostic for invalid YAML` — asserts `code === 'md.frontmatter.yaml'`,
   `severity === 1`, `source === 'markdown'`, message matches `/YAML frontmatter/`.
2. `returns no frontmatter diagnostic for valid YAML frontmatter` — asserts no
   `md.frontmatter.yaml` diagnostic for well-formed frontmatter.
3. `returns no frontmatter diagnostic for documents without frontmatter` — asserts no
   `md.frontmatter.yaml` diagnostic for documents that have no `---` block.

The minimal mock context (`{ language: { files: { get: () => undefined } } }`) is sufficient
because `isLanguageDocument` returns early on `document.languageId === 'markdown'`, and
`computeDiagnostics` finds no broken links in documents with no external link references.

### Validation Command

```sh

```

Result: **7 test files passed, 94 tests passed** (3 new + 91 prior, no regressions).

## Subject References

- [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/src/service-plugins.ts`
- `src/extensions/vscode/test/service-plugins.test.ts`
