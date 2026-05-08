---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/language-service': patch
'vscode-templjs': patch
---

<!-- markdownlint-disable MD041 -->

Implement Prettier service-plugin adapter with runtime planning and OCP-compliant orchestration (WI-116). Extracts Prettier host plugin logic into `prettier-adapter.ts` with `planPrettierAdapterRuntime` for capability-aware gating based on `prettierHostLanguages` configuration.
