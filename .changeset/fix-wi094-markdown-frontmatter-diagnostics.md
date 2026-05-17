---
'vscode-templjs': patch
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

fix(vscode): show markdown frontmatter YAML errors in templated files

Templated markdown files now surface malformed YAML frontmatter errors alongside
templjs diagnostics, matching the authoring feedback already available for
templated YAML files.

The VS Code extension now routes markdown-frontmatter validation through the
markdown-specific Volar diagnostics path so `.md.templ`, `.md.tmpl`, and
`.md.tpl` files report frontmatter parse failures in place.

This also hardens the extension diagnostics pipeline so templjs and host-language
diagnostics can coexist without one publish replacing the other.
