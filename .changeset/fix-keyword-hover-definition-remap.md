---
'@templjs/language-service': patch
'@templjs/semantify': patch
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

fix(language-service): correct keyword hover, definition, and markdown link ranges

Prevents `for` and `in` keyword offsets from resolving loop iterable definitions
or alias hover targets in templated host documents.

Also remaps markdown `link.no-such-reference` diagnostics onto the actual
reference text when template syntax padding shifts the raw markdown range.
