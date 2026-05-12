---
'@templjs/volar': patch
---

<!-- markdownlint-disable MD041 -->

Remove multi-token statement regex from Volar diagnostic and intellisense providers; use core-backed ForScope.iterableExpression instead.

- `scope-resolution`: expose `iterableExpression` on `ForScope` via `binding.sourceExpression` from `@templjs/core`
- `diagnostic-provider`: replace for-header regex with `ForScope` lookup — fixes false truncation for complex iterables such as `users[activeIndex + 1]`
- `intellisense-provider`: add deterministic `parseForHeader()` helper and replace three multi-token regex sites (completion, hover, definition)
