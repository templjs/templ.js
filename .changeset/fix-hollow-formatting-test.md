---
'vscode-templjs': patch
---

<!-- markdownlint-disable MD041 -->

fix(test): remove hollow formatting test that only asserted mock function existence

The VS Code extension server does not register an `onDocumentFormatting` handler;
the removed test could never exercise real server behavior.
