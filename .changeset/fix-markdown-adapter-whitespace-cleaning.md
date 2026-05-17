---
'vscode-templjs': patch
'@templjs/language-service': patch
'@templjs/language-server': patch
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

fix(volar,vscode): stabilize markdown adapter offset mapping and trim-marker semantics

Fixes runtime adapter diagnostics delegation and ensures proper whitespace handling
in text-only template cleaning mode:

- **markdown-adapter.ts**: Normalize whitespace-only binary paths before command invocation;
  improve offset mapping edge cases (sparse line offset arrays, undefined byte mappings)
- **volar/index.ts**: Preserve correct trim-marker newline semantics in preserve-width mode;
  suppress trim-marker-adjacent whitespace (including newlines) in text-only mode
- **vscode extension**: Expand branch coverage for formatting discovery, binary resolution,
  and diagnostic result extraction helpers

All changes maintain backward compatibility with existing virtual document provider
and host language diagnostics delegation workflows.
