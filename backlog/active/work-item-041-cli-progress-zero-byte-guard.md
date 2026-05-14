---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:041-cli-progress-zero-byte-guard
title: '41: Guard Progress Percentage Against Zero-Byte File Division'
summary: Guard Progress Percentage Against Zero-Byte File Division
type: work-item
subtype: bug
lifecycle: active
status: ready
status_reason: prioritized
priority: low
estimated: 1
actual: 0
links:
  evidence:
    - '[[record-20260514-223855-041-cli-progress-zero-byte-guard]]'
---

## Goal

Prevent `NaN%` or `Infinity%` progress output when processing zero-byte files.

## Background

PR 23 unresolved comment: `createProgressReporter()` computes `bytesRead / totalBytes` without guarding against zero-byte totals, which can emit invalid progress percentages for empty files.

## Tasks

- [ ] Add zero-byte guard in `createProgressReporter()` progress calculation
- [ ] Ensure progress is finite integer (0-100) for all file sizes
- [ ] Add test case for zero-byte file progress reporting
- [ ] Verify behavior for empty stdin

## Acceptance Criteria

- [ ] Zero-byte files show stable progress (e.g., 100% or no output)
- [ ] Progress percentage always `Number.isFinite()` and in range 0-100
- [ ] No division by zero errors in progress calculation
- [ ] Test coverage for edge case added

## Notes

Reference: [PR 23 comment](https://github.com/templjs/templ.js/pull/23#discussion_r2901437332)

Suggested fix:

```typescript
const progress = totalBytes > 0 ? Math.min(100, Math.floor((bytesRead / totalBytes) * 100)) : 100;
```

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
