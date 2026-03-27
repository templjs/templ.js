---
id: docs-functions-datetime-001
type: document
subtype: reference
lifecycle: active
status: ready
title: DateTime Functions Reference
---

## Scope

Date/time filter functions available through the core query engine.

Source of truth: [src/packages/core/src/query-engine/functions/datetime-functions.ts](../../src/packages/core/src/query-engine/functions/datetime-functions.ts)

## Function List (17)

| Function       | Signature                    | Description                                           | Example                                                 |
| -------------- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `now`          | `now()`                      | Current timestamp (ms).                               | `now() -> 1708300800000`                                |
| `format`       | `format(value, format)`      | Format date/timestamp using tokens like `YYYY-MM-DD`. | `1708300800000 \| format("YYYY-MM-DD") -> "2024-02-18"` |
| `parse`        | `parse(value, format)`       | Parse formatted date string to timestamp.             | `"2024-02-18" \| parse("YYYY-MM-DD") -> 1708214400000`  |
| `addDays`      | `addDays(value, days)`       | Add days.                                             | `1708300800000 \| addDays(1) -> 1708387200000`          |
| `addHours`     | `addHours(value, hours)`     | Add hours.                                            | `1708300800000 \| addHours(2) -> 1708308000000`         |
| `addMinutes`   | `addMinutes(value, minutes)` | Add minutes.                                          | `1708300800000 \| addMinutes(30) -> 1708302600000`      |
| `getYear`      | `getYear(value)`             | Get year.                                             | `1708300800000 \| getYear -> 2024`                      |
| `getMonth`     | `getMonth(value)`            | Get month (`0-11`).                                   | `1708300800000 \| getMonth -> 1`                        |
| `getDay`       | `getDay(value)`              | Get day-of-month.                                     | `1708300800000 \| getDay -> 18`                         |
| `getHour`      | `getHour(value)`             | Get hour (`0-23`).                                    | `1708300800000 \| getHour -> 12`                        |
| `timezone`     | `timezone(value, tz)`        | Format in IANA timezone.                              | `1708300800000 \| timezone("America/New_York")`         |
| `timestamp`    | `timestamp(value)`           | Coerce date-like value to timestamp.                  | `"2024-02-18T00:00:00Z" \| timestamp -> 1708214400000`  |
| `getDate`      | `getDate(value)`             | Alias day-of-month accessor.                          | `1708300800000 \| getDate -> 18`                        |
| `getDayOfWeek` | `getDayOfWeek(value)`        | Weekday (`0=Sunday`).                                 | `1708300800000 \| getDayOfWeek -> 0`                    |
| `toISO`        | `toISO(value)`               | Convert to ISO string.                                | `1708300800000 \| toISO -> "2024-02-19T...Z"`           |
| `fromISO`      | `fromISO(value)`             | Parse ISO string to timestamp.                        | `"2024-02-18T12:00:00.000Z" \| fromISO`                 |
| `diff`         | `diff(value, other)`         | `other - value` in milliseconds.                      | `1708300800000 \| diff(1708387200000) -> 86400000`      |

## Notes

- `format` and `parse` intentionally support a narrow token set and a simple parser path.
- `timezone` output format is `YYYY-MM-DD HH:mm:ss`.
- Date inputs accept numbers and Date-like values where supported.
