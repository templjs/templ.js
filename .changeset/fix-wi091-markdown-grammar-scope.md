---
'vscode-templjs': patch
---

<!-- markdownlint-disable MD041 -->

fix(vscode): restore markdown scope for .md.tmpl injection grammar

Corrects the TextMate grammar include scope in `injection-markdown.json` from
`source.gfm` (Atom ecosystem, not present in VS Code) to `text.html.markdown`
(VS Code's built-in Markdown grammar scope). This restores full Markdown syntax
highlighting for `.md.tmpl`, `.md.templ`, and `.md.tpl` files. Previously these
files rendered as plain text with only templjs expression tokens coloured.

Also hardens the frontmatter begin anchor from `^---\s*$` to `\A---\s*$` so the
YAML frontmatter region is anchored to the document start, not every line.
