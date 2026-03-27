---
id: docs-functions-number-001
type: document
subtype: reference
lifecycle: active
status: ready
title: Number Functions Reference
---

## Scope

Number filter functions available through the core query engine.

Source of truth: [src/packages/core/src/query-engine/functions/number-functions.ts](../../src/packages/core/src/query-engine/functions/number-functions.ts)

## Function List (23)

| Function     | Signature                   | Description                         | Example                           |
| ------------ | --------------------------- | ----------------------------------- | --------------------------------- |
| `round`      | `round(value, decimals?)`   | Round to decimal places.            | `3.14159 \| round(2) -> 3.14`     |
| `floor`      | `floor(value)`              | Round down.                         | `3.9 \| floor -> 3`               |
| `ceil`       | `ceil(value)`               | Round up.                           | `3.1 \| ceil -> 4`                |
| `abs`        | `abs(value)`                | Absolute value.                     | `-5 \| abs -> 5`                  |
| `min`        | `min(value, ...other)`      | Minimum from values or array.       | `[5,2,8] \| min -> 2`             |
| `max`        | `max(value, ...other)`      | Maximum from values or array.       | `[5,2,8] \| max -> 8`             |
| `clamp`      | `clamp(value, min, max)`    | Clamp into range.                   | `10 \| clamp(0,5) -> 5`           |
| `sqrt`       | `sqrt(value)`               | Square root.                        | `16 \| sqrt -> 4`                 |
| `pow`        | `pow(value, exponent)`      | Exponentiation.                     | `2 \| pow(3) -> 8`                |
| `log`        | `log(value, base?)`         | Logarithm (`e` base by default).    | `8 \| log(2) -> 3`                |
| `exp`        | `exp(value)`                | Exponential.                        | `1 \| exp -> 2.718...`            |
| `sin`        | `sin(value)`                | Sine (radians).                     | `0 \| sin -> 0`                   |
| `cos`        | `cos(value)`                | Cosine (radians).                   | `0 \| cos -> 1`                   |
| `tan`        | `tan(value)`                | Tangent (radians).                  | `0 \| tan -> 0`                   |
| `sum`        | `sum(arrayValue)`           | Sum numbers in array.               | `[1,2,3] \| sum -> 6`             |
| `avg`        | `avg(arrayValue)`           | Average of array values.            | `[2,4,6] \| avg -> 4`             |
| `product`    | `product(arrayValue)`       | Product of array values.            | `[2,3,4] \| product -> 24`        |
| `sign`       | `sign(value)`               | Numeric sign `-1/0/1`.              | `-7 \| sign -> -1`                |
| `toFixed`    | `toFixed(value, decimals?)` | Format fixed-point string.          | `3.14159 \| toFixed(2) -> "3.14"` |
| `parseInt`   | `parseInt(value, radix?)`   | Parse integer from string.          | `"101" \| parseInt(2) -> 5`       |
| `parseFloat` | `parseFloat(value)`         | Parse float from string.            | `"3.14" \| parseFloat -> 3.14`    |
| `isNaN`      | `isNaN(value)`              | Check NaN after numeric coercion.   | `"abc" \| isNaN -> true`          |
| `isFinite`   | `isFinite(value)`           | Check finite number after coercion. | `42 \| isFinite -> true`          |

## Notes

- `sum`, `avg`, and `product` throw when input is not an array.
- `log` throws when base is `<= 0` or `== 1`.
- `toFixed` returns a string, not a number.
