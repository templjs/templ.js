---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/language-service': patch
'vscode-templjs': patch
---

<!-- markdownlint-disable MD041 -->

Implement HTML service-plugin adapter with runtime planning and OCP-compliant orchestration (WI-114). Moves HTML host plugin logic into `html-adapter.ts` with `planHtmlAdapterRuntime` for capability-aware gating. The adapter is disabled when `vscode.html-language-features` is not registered.
