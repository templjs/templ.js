---
'@templjs/core': minor
'@templjs/cli': minor
'@templjs/volar': minor
'@templjs/context-graph': minor
---

<!-- markdownlint-disable MD041 -->

Replace loop-only scope binding model with a generic template binding API.

`TemplateScopeBinding` and `extractTemplateScopeBindings` are replaced by `TemplateBinding` and `extractTemplateBindings`. The new model introduces a `kind` discriminant (`for-alias`, `for-value-alias`, `set-variable`) and renames `alias`/`iterablePath` to `name`/`sourcePath`. A new `getTemplateBindingsAtOffset` helper filters to bindings in scope at a given cursor position.

`set` variable bindings are now extracted alongside `for` loop aliases, giving IDE consumers a unified view of every locally-bound name in scope.

Volar consumers (`scope-resolution`, `context-graph-adapter`, `intellisense-provider`) are migrated to the new API. Local alias hover and go-to-definition now resolve through `resolveLocalAliasReference`, which covers both expression contexts and statement-expression contexts (e.g. `{% if item %}`).
