---
'@templjs/language-service': patch
'templjs': patch
---

<!-- markdownlint-disable MD041 -->

Implement HTML service-plugin adapter with runtime planning and OCP-compliant orchestration (WI-114). Moves HTML host plugin logic into `html-adapter.ts` with `planHtmlAdapterRuntime` for capability-aware gating. In the VS Code extension, the adapter runtime is marked unavailable when `vscode.html-language-features` is not registered.
