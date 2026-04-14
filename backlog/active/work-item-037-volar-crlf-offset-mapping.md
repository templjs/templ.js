---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:037-volar-crlf-offset-mapping
title: '37: Normalize CRLF Offset Mapping in Volar Virtual Code'
summary: Normalize CRLF Offset Mapping in Volar Virtual Code
type: work-item
subtype: task
lifecycle: active
status: ready
status_reason: prioritized
priority: medium
estimated: 2
actual: 0
---

## Goal

Ensure offset mapping and diagnostic alignment are correct for files using CRLF line endings.

## Background

Offset computations currently prioritize `\n` handling and can drift in CRLF-heavy edits, especially around templated regions and incremental updates.

## Tasks

- [ ] Audit CRLF behavior in strip/mapping and incremental update paths
- [ ] Add CRLF-specific regression tests for mapping and diagnostics
- [ ] Validate parity with LF behavior for equivalent templates

## Acceptance Criteria

- [ ] Diagnostics align to correct source locations in CRLF files
- [ ] Incremental updates preserve mapping correctness under CRLF edits
- [ ] New CRLF tests pass and guard regressions

## Relationships

- `depends_on`: [[work-item-029-cli-signal-handling]]
