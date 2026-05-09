---
'@templjs/core': patch
'@templjs/cli': patch
'@templjs/volar': patch
'@templjs/context-graph': patch
'@templjs/language-service': patch
'templjs': patch
---

<!-- markdownlint-disable MD041 -->

Implement YAML service-plugin adapter with runtime planning and OCP-compliant orchestration (WI-113). Moves YAML diagnostic plugin logic into `yaml-adapter.ts` with `planYamlAdapterRuntime` for capability-aware gating. The adapter is disabled when `redhat.vscode-yaml` is not registered, preventing duplication when the Red Hat YAML extension handles `.yaml` files.
