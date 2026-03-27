---
id: docs-functions-object-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Object Functions Reference
---

## Scope

Object filter functions available through the core query engine.

Source of truth: [src/packages/core/src/query-engine/functions/object-functions.ts](../../src/packages/core/src/query-engine/functions/object-functions.ts)

## Function List (11)

| Function  | Signature                               | Description                    | Example                               |
| --------- | --------------------------------------- | ------------------------------ | ------------------------------------- |
| `keys`    | `keys(objectValue)`                     | Object keys.                   | `{a:1,b:2} \| keys -> ["a","b"]`      |
| `values`  | `values(objectValue)`                   | Object values.                 | `{a:1,b:2} \| values -> [1,2]`        |
| `entries` | `entries(objectValue)`                  | `[key, value]` entries.        | `{a:1} \| entries -> [["a",1]]`       |
| `has`     | `has(objectValue, key)`                 | Property existence.            | `{a:1} \| has("a") -> true`           |
| `get`     | `get(objectValue, path, defaultValue?)` | Dot-path lookup with fallback. | `{a:{b:1}} \| get("a.b") -> 1`        |
| `merge`   | `merge(objectValue, ...objects)`        | Shallow merge.                 | `{a:1} \| merge({b:2}) -> {a:1,b:2}`  |
| `pick`    | `pick(objectValue, keys)`               | Keep only selected keys.       | `{a:1,b:2} \| pick(["a"]) -> {a:1}`   |
| `omit`    | `omit(objectValue, keys)`               | Remove selected keys.          | `{a:1,b:2} \| omit(["b"]) -> {a:1}`   |
| `length`  | `length(objectValue)`                   | Number of object keys.         | `{a:1,b:2} \| length -> 2`            |
| `assign`  | `assign(objectValue, source)`           | Object.assign-style merge.     | `{a:1} \| assign({b:2}) -> {a:1,b:2}` |
| `isEmpty` | `isEmpty(value)`                        | Empty check for object/array.  | `{}` \| isEmpty -> true               |

## Notes

- `get` supports dot notation paths (for example `"a.b.c"`).
- `pick` and `omit` require an array of keys.
- `isEmpty` treats non-object values as empty and arrays by length.
