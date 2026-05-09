---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/language-service': patch
'vscode-templjs': patch
---

<!-- markdownlint-disable MD041 -->

Implement JSON service-plugin adapter with runtime planning and OCP-compliant orchestration (WI-115). Moves JSON host plugin logic into `json-adapter.ts` with `planJsonAdapterRuntime` for capability-aware gating. The adapter is disabled when `vscode.json-language-features` is not registered.
