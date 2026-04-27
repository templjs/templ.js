---
'@templjs/cli': patch
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

fix(build): resolve CI/local build drift by switching to `tsc -b --force` and adding tsconfig paths overrides in cli, volar, and vscode extension packages
