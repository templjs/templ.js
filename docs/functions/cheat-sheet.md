---
id: cheatsheet-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Function Cheat Sheet
---

{% raw %}

Quick reference for all 55+ templjs built-in functions. Use pipe syntax in templates: `{{ value | functionName(args) }}`.

## String Functions (20)

| Function     | Signature                      | Example                                       |
| ------------ | ------------------------------ | --------------------------------------------- |
| `upper`      | `upper()`                      | `"hello" \| upper` → `"HELLO"`                |
| `lower`      | `lower()`                      | `"HELLO" \| lower` → `"hello"`                |
| `capitalize` | `capitalize()`                 | `"hello" \| capitalize` → `"Hello"`           |
| `trim`       | `trim()`                       | `"  hi  " \| trim` → `"hi"`                   |
| `ltrim`      | `ltrim()`                      | `"  hi  " \| ltrim` → `"hi  "`                |
| `rtrim`      | `rtrim()`                      | `"  hi  " \| rtrim` → `"  hi"`                |
| `replace`    | `replace(search, replacement)` | `"hello" \| replace("l", "r")` → `"herro"`    |
| `slice`      | `slice(start[, end])`          | `"hello" \| slice(0, 3)` → `"hel"`            |
| `split`      | `split(delimiter)`             | `"a,b" \| split(",")` → `["a","b"]`           |
| `join`       | `join(separator)`              | `["a","b"] \| join(",")` → `"a,b"`            |
| `startsWith` | `startsWith(prefix)`           | `"hello" \| startsWith("he")` → `true`        |
| `endsWith`   | `endsWith(suffix)`             | `"hello" \| endsWith("lo")` → `true`          |
| `includes`   | `includes(substring)`          | `"hello world" \| includes("world")` → `true` |
| `indexOf`    | `indexOf(substring)`           | `"hello" \| indexOf("ll")` → `2`              |
| `padStart`   | `padStart(length[, char])`     | `"5" \| padStart(3, "0")` → `"005"`           |
| `padEnd`     | `padEnd(length[, char])`       | `"5" \| padEnd(3, "0")` → `"500"`             |
| `repeat`     | `repeat(count)`                | `"ab" \| repeat(3)` → `"ababab"`              |
| `reverse`    | `reverse()`                    | `"hello" \| reverse` → `"olleh"`              |
| `escape`     | `escape()`                     | `"<b>" \| escape` → `"&lt;b&gt;"`             |
| `truncate`   | `truncate(length[, suffix])`   | `"hello world" \| truncate(5)` → `"hello..."` |

## Number Functions (23)

| Function     | Signature                       | Example                            |
| ------------ | ------------------------------- | ---------------------------------- |
| `round`      | `round([decimals])`             | `3.14159 \| round(2)` → `3.14`     |
| `floor`      | `floor()`                       | `3.7 \| floor` → `3`               |
| `ceil`       | `ceil()`                        | `3.2 \| ceil` → `4`                |
| `abs`        | `abs()`                         | `-5 \| abs` → `5`                  |
| `min`        | `min(b[, ...])` or `min(array)` | `min(5, 2, 8)` → `2`               |
| `max`        | `max(b[, ...])` or `max(array)` | `max(5, 2, 8)` → `8`               |
| `clamp`      | `clamp(min, max)`               | `5 \| clamp(1, 3)` → `3`           |
| `sqrt`       | `sqrt()`                        | `16 \| sqrt` → `4`                 |
| `pow`        | `pow(exponent)`                 | `2 \| pow(3)` → `8`                |
| `log`        | `log([base])`                   | `8 \| log(2)` → `3`                |
| `exp`        | `exp()`                         | `1 \| exp` → `2.718...`            |
| `sin`        | `sin()`                         | `0 \| sin` → `0`                   |
| `cos`        | `cos()`                         | `0 \| cos` → `1`                   |
| `tan`        | `tan()`                         | `0 \| tan` → `0`                   |
| `sign`       | `sign()`                        | `-5 \| sign` → `-1`                |
| `toFixed`    | `toFixed(decimals)`             | `3.14159 \| toFixed(2)` → `"3.14"` |
| `parseInt`   | `parseInt([radix])`             | `"42" \| parseInt` → `42`          |
| `parseFloat` | `parseFloat()`                  | `"3.14" \| parseFloat` → `3.14`    |
| `isNaN`      | `isNaN()`                       | `NaN \| isNaN` → `true`            |
| `isFinite`   | `isFinite()`                    | `42 \| isFinite` → `true`          |
| `sum`        | `sum(array)`                    | `[1,2,3] \| sum` → `6`             |
| `avg`        | `avg(array)`                    | `[2,4,6] \| avg` → `4`             |
| `product`    | `product(array)`                | `[2,3,4] \| product` → `24`        |

## Datetime Functions (15)

| Function             | Signature                | Example                                                 |
| -------------------- | ------------------------ | ------------------------------------------------------- |
| `now`                | `now()`                  | `now()` → Unix ms timestamp                             |
| `format`             | `format(pattern[, tz])`  | `ts \| format("YYYY-MM-DD")` → `"2024-02-18"`           |
| `parse`              | `parse(string, pattern)` | `"2024-02-18" \| parse("YYYY-MM-DD")` → timestamp       |
| `timestamp`          | `timestamp(isoString)`   | `"2024-02-18T12:00:00Z" \| timestamp` → ms              |
| `toISO`              | `toISO()`                | `ts \| toISO` → `"2024-02-18T12:00:00.000Z"`            |
| `fromISO`            | `fromISO()`              | `"2024-02-18T12:00:00.000Z" \| fromISO` → ms            |
| `addDays`            | `addDays(n)`             | `ts \| addDays(5)` → ts+5days                           |
| `addHours`           | `addHours(n)`            | `ts \| addHours(3)` → ts+3hrs                           |
| `addMinutes`         | `addMinutes(n)`          | `ts \| addMinutes(30)` → ts+30min                       |
| `diff`               | `diff(other)`            | `ts \| diff(ts2)` → ms difference                       |
| `getYear`            | `getYear()`              | `ts \| getYear` → `2024`                                |
| `getMonth`           | `getMonth()`             | `ts \| getMonth` → `1` (0-indexed)                      |
| `getDay` / `getDate` | `getDay()`               | `ts \| getDay` → `18`                                   |
| `getHour`            | `getHour()`              | `ts \| getHour` → `12`                                  |
| `getDayOfWeek`       | `getDayOfWeek()`         | `ts \| getDayOfWeek` → `0` (0=Sun)                      |
| `timezone`           | `timezone(tz)`           | `ts \| timezone("America/New_York")` → formatted string |

## Array Functions (19)

| Function   | Signature             | Example                                      |
| ---------- | --------------------- | -------------------------------------------- |
| `length`   | `length()`            | `[1,2,3] \| length` → `3`                    |
| `size`     | `size()`              | `[1,2,3] \| size` → `3` (alias)              |
| `first`    | `first()`             | `[1,2,3] \| first` → `1`                     |
| `last`     | `last()`              | `[1,2,3] \| last` → `3`                      |
| `nth`      | `nth(index)`          | `["a","b","c"] \| nth(1)` → `"b"`            |
| `reverse`  | `reverse()`           | `[1,2,3] \| reverse` → `[3,2,1]`             |
| `sort`     | `sort([key])`         | `[3,1,2] \| sort` → `[1,2,3]`                |
| `unique`   | `unique()`            | `[1,2,2,3] \| unique` → `[1,2,3]`            |
| `filter`   | `filter(predicate)`   | `items \| filter("active")`                  |
| `map`      | `map(fn\|key)`        | `users \| map("name")` → names array         |
| `reduce`   | `reduce(fn, initial)` | `[1,2,3] \| reduce("+", 0)` → `6`            |
| `find`     | `find(predicate)`     | `users \| find("id == 1")` → first match     |
| `includes` | `includes(value)`     | `[1,2,3] \| includes(2)` → `true`            |
| `indexOf`  | `indexOf(value)`      | `[1,2,3] \| indexOf(2)` → `1`                |
| `slice`    | `slice(start[, end])` | `[1,2,3,4] \| slice(1, 3)` → `[2,3]`         |
| `concat`   | `concat(other)`       | `[1,2] \| concat([3,4])` → `[1,2,3,4]`       |
| `flatten`  | `flatten([depth])`    | `[[1,2],[3]] \| flatten` → `[1,2,3]`         |
| `where`    | `where(key)`          | `items \| where("published")` → truthy items |
| `join`     | `join(separator)`     | `[1,2,3] \| join(",")` → `"1,2,3"`           |

## Object Functions (11)

| Function  | Signature              | Example                                |
| --------- | ---------------------- | -------------------------------------- |
| `keys`    | `keys()`               | `{a:1,b:2} \| keys` → `["a","b"]`      |
| `values`  | `values()`             | `{a:1,b:2} \| values` → `[1,2]`        |
| `entries` | `entries()`            | `{a:1} \| entries` → `[["a",1]]`       |
| `has`     | `has(key)`             | `{a:1} \| has("a")` → `true`           |
| `get`     | `get(path[, default])` | `obj \| get("a.b", 0)` → value or 0    |
| `merge`   | `merge(other)`         | `{a:1} \| merge({b:2})` → `{a:1,b:2}`  |
| `assign`  | `assign(other)`        | `{a:1} \| assign({b:2})` → `{a:1,b:2}` |
| `pick`    | `pick(keys)`           | `obj \| pick(["a","c"])` → subset      |
| `omit`    | `omit(keys)`           | `obj \| omit(["b"])` → obj without b   |
| `length`  | `length()`             | `{a:1,b:2} \| length` → `2`            |
| `isEmpty` | `isEmpty()`            | `{} \| isEmpty` → `true`               |

## Utility Functions (6)

| Function   | Signature           | Example                                |
| ---------- | ------------------- | -------------------------------------- |
| `default`  | `default(fallback)` | `null \| default("Guest")` → `"Guest"` |
| `fallback` | `fallback(value)`   | alias for `default`                    |
| `typeof`   | `typeof()`          | `123 \| typeof` → `"number"`           |
| `string`   | `string()`          | `123 \| string` → `"123"`              |
| `number`   | `number([default])` | `"42" \| number` → `42`                |
| `json`     | `json()`            | `{a:1} \| json` → `'{"a":1}'`          |

## Filter Pipe Syntax

```templ
{{ value | filter }}
{{ value | filter(arg1, arg2) }}
{{ value | filter1 | filter2(arg) }}
```

## Expression Predicates

`filter`, `find`, and `where` accept expression strings:

```templ
{{ scores | filter("> 90") }}
{{ users | find("active == true") }}
{{ items | where("published") }}
```

## Quick Path Reference

```templ
{{ user.name }}          {{/* dot notation */}}
{{ items[0] }}           {{/* array index */}}
{{ items[idx] }}         {{/* variable index */}}
{{ map["key name"] }}    {{/* quoted key */}}
```

## See Also

- [String Functions Reference](./string-functions.md)
- [Number Functions Reference](./number-functions.md)
- [Datetime Functions Reference](./datetime-functions.md)
- [Array Functions Reference](./array-functions.md)
- [Object Functions Reference](./object-functions.md)
- [Query Language Guide](../query-language.md)

{% endraw %}
