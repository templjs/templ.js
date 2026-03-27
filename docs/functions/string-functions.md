---
id: docs-functions-string-001
type: document
subtype: reference
lifecycle: active
status: ready
title: String Functions Reference
---

## Scope

String filter functions available through the core query engine.

Source of truth: [src/packages/core/src/query-engine/functions/string-functions.ts](../../src/packages/core/src/query-engine/functions/string-functions.ts)

## Function List (20)

| Function     | Signature                             | Description                    | Example                                      |
| ------------ | ------------------------------------- | ------------------------------ | -------------------------------------------- |
| `upper`      | `upper(value)`                        | Convert string to uppercase.   | `"hello" \| upper -> "HELLO"`                |
| `lower`      | `lower(value)`                        | Convert string to lowercase.   | `"HELLO" \| lower -> "hello"`                |
| `capitalize` | `capitalize(value)`                   | Capitalize first character.    | `"hello" \| capitalize -> "Hello"`           |
| `trim`       | `trim(value)`                         | Trim both ends.                | `"  hi  " \| trim -> "hi"`                   |
| `ltrim`      | `ltrim(value)`                        | Trim left side.                | `"  hi" \| ltrim -> "hi"`                    |
| `rtrim`      | `rtrim(value)`                        | Trim right side.               | `"hi  " \| rtrim -> "hi"`                    |
| `replace`    | `replace(value, search, replacement)` | Replace all substring matches. | `"a-b-a" \| replace("a", "x") -> "x-b-x"`    |
| `slice`      | `slice(value, start, end?)`           | Substring slice.               | `"hello" \| slice(1, 4) -> "ell"`            |
| `split`      | `split(value, delimiter)`             | Split string into array.       | `"a,b" \| split(",") -> ["a", "b"]`          |
| `join`       | `join(arrayValue, separator)`         | Join array into string.        | `["a","b"] \| join("-") -> "a-b"`            |
| `startsWith` | `startsWith(value, prefix)`           | Prefix check.                  | `"hello" \| startsWith("he") -> true`        |
| `endsWith`   | `endsWith(value, suffix)`             | Suffix check.                  | `"hello" \| endsWith("lo") -> true`          |
| `includes`   | `includes(value, substring)`          | Contains check.                | `"hello" \| includes("ell") -> true`         |
| `indexOf`    | `indexOf(value, substring)`           | Index lookup.                  | `"hello" \| indexOf("l") -> 2`               |
| `padStart`   | `padStart(value, length, fillStr?)`   | Left pad to target length.     | `"7" \| padStart(3, "0") -> "007"`           |
| `padEnd`     | `padEnd(value, length, fillStr?)`     | Right pad to target length.    | `"7" \| padEnd(3, "0") -> "700"`             |
| `repeat`     | `repeat(value, count)`                | Repeat string.                 | `"ab" \| repeat(2) -> "abab"`                |
| `reverse`    | `reverse(value)`                      | Reverse characters.            | `"abc" \| reverse -> "cba"`                  |
| `escape`     | `escape(value)`                       | HTML-escape text.              | `"<b>" \| escape -> "&lt;b&gt;"`             |
| `truncate`   | `truncate(value, length, suffix?)`    | Truncate with optional suffix. | `"hello world" \| truncate(5) -> "hello..."` |

## Notes

- `replace` uses a global regular expression built from `search`.
- `join` expects an array input and throws on non-array values.
- `truncate` appends `...` by default when a suffix is not provided.
