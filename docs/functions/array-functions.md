---
id: docs-functions-array-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Array Functions Reference
---

## Scope

Array filter functions available through the core query engine.

Source of truth: [src/packages/core/src/query-engine/functions/array-functions.ts](../../src/packages/core/src/query-engine/functions/array-functions.ts)

## Function List (20)

| Function   | Signature                          | Description                         | Example                                            |
| ---------- | ---------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `length`   | `length(arrayValue)`               | Array length.                       | `[1,2,3] \| length -> 3`                           |
| `size`     | `size(value)`                      | Size of array/object.               | `{a:1,b:2} \| size -> 2`                           |
| `first`    | `first(arrayValue)`                | First element.                      | `[10,20] \| first -> 10`                           |
| `last`     | `last(arrayValue)`                 | Last element.                       | `[10,20] \| last -> 20`                            |
| `nth`      | `nth(arrayValue, index)`           | Element at index.                   | `["a","b","c"] \| nth(1) -> "b"`                   |
| `reverse`  | `reverse(arrayValue)`              | Reverse array copy.                 | `[1,2,3] \| reverse -> [3,2,1]`                    |
| `sort`     | `sort(arrayValue, key?)`           | Sort values or object list by key.  | `[{n:2},{n:1}] \| sort("n") -> [{n:1},{n:2}]`      |
| `unique`   | `unique(arrayValue)`               | Remove duplicates.                  | `[1,1,2] \| unique -> [1,2]`                       |
| `flatten`  | `flatten(arrayValue, depth?)`      | Flatten nested arrays.              | `[[1],[2]] \| flatten -> [1,2]`                    |
| `slice`    | `slice(arrayValue, start, end?)`   | Array slice.                        | `[1,2,3,4] \| slice(1,3) -> [2,3]`                 |
| `concat`   | `concat(arrayValue, arrays)`       | Concatenate arrays.                 | `[1,2] \| concat([3,4]) -> [1,2,3,4]`              |
| `join`     | `join(arrayValue, separator)`      | Join to string.                     | `["a","b"] \| join("-") -> "a-b"`                  |
| `filter`   | `filter(arrayValue, predicate)`    | Filter with function or expression. | `[1,2,3] \| filter("> 1") -> [2,3]`                |
| `map`      | `map(arrayValue, fn)`              | Map with function or property key.  | `[{n:1}] \| map("n") -> [1]`                       |
| `find`     | `find(arrayValue, condition)`      | First matching item.                | `[1,2,3] \| find("> 1") -> 2`                      |
| `includes` | `includes(arrayValue, item)`       | Membership check.                   | `[1,2,3] \| includes(2) -> true`                   |
| `indexOf`  | `indexOf(arrayValue, item)`        | Index lookup.                       | `[1,2,3] \| indexOf(2) -> 1`                       |
| `reduce`   | `reduce(arrayValue, fn, initial?)` | Reduce to one value.                | `[1,2,3] \| reduce((a,v)=>a+v,0) -> 6`             |
| `where`    | `where(arrayValue, key)`           | Keep entries with truthy key.       | `[{a:true},{a:false}] \| where("a") -> [{a:true}]` |

## Notes

- Expression forms in `filter` and `find` support simple scalar and field comparisons.
- `sort` and `reverse` return a copied array and do not mutate input.
- `where` is a convenience alias for truthy-key filtering.
