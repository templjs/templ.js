---
'templjs': patch
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

fix(vscode): surface YAML frontmatter parse errors for .md.tmpl files

Routes templjs diagnostics through dedicated Volar service plugins for generic,
markdown-frontmatter, and YAML host-language paths, while keeping the markdown
frontmatter coupling isolated to a markdown-specific diagnostics plugin.

Ensures root virtual documents validate against source snapshot text, so
templjs diagnostics run correctly for `.yaml.templ` and `.md.templ` files.

Adds malformed frontmatter fence fallback detection for markdown templates and
runs `yaml-language-service` on the cleaned frontmatter slice so YAML parse
errors surface alongside templjs structural diagnostics.

Also restores host-language grammar delegation scopes for Markdown, YAML, HTML,
and JSON injection grammars and expands regression coverage across extension,
server, and service-plugin tests.
