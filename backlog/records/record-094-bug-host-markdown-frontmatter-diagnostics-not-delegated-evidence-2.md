---
$schema: schemas/work-management/frontmatter/record.json
id: record:094-bug-host-markdown-frontmatter-diagnostics-not-delegated-evidence-2
title: '094: YAML frontmatter validation implementation evidence 2'
summary: markdown-specific Volar diagnostics now surface malformed YAML frontmatter with focused regression coverage
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

Two source files were updated to deliver real YAML frontmatter diagnostics for templated markdown:

**`src/extensions/vscode/src/service-plugins.ts`**

- Split diagnostics into dedicated Volar service plugins for generic templjs diagnostics,
  markdown-specific diagnostics, and YAML host diagnostics.
- `createTempljsMarkdownDiagnosticsPlugin` now detects frontmatter boundaries, preserves
  templjs diagnostics for the full source snapshot, and validates the cleaned frontmatter
  slice through `yaml-language-service`.
- Malformed `---` and `+++` frontmatter fences use a fallback closing-fence matcher so parse
  errors still surface even when the frontmatter parser declines to classify the block.

**`src/extensions/vscode/src/server.ts`**

- Host diagnostics collection now reads from the same Volar validation pipeline used by the
  service plugins, so host-language and templjs diagnostics publish together after open/change
  and watched-schema reload events.

### Test Coverage

Focused regression coverage lives in `src/extensions/vscode/test/service-plugins.test.ts`.

The markdown diagnostics plugin is covered directly with tests that:

1. route markdown templjs diagnostics to the markdown-specific plugin,
2. surface YAML diagnostics for malformed markdown frontmatter templates, and
3. handle malformed `+++` frontmatter fences without leaking into the markdown body.

Server integration tests also verify markdown frontmatter diagnostics are merged with templjs
diagnostics during the extension/server request path.

### Validation Command

```sh
rtk pnpm --filter vscode-templjs test -- test/service-plugins.test.ts test/server.test.ts
```

Result: Focused extension service-plugin and server suites passed after the markdown frontmatter
diagnostics path was moved into Volar service plugins.

## Subject References

- [[work-item-094-bug-host-markdown-frontmatter-diagnostics-not-delegated]]

## Artifact References

- `src/extensions/vscode/src/server.ts`
- `src/extensions/vscode/src/service-plugins.ts`
- `src/extensions/vscode/test/service-plugins.test.ts`
