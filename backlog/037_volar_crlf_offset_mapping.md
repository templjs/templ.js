---
id: wi-037
type: work-item
subtype: task
lifecycle: active
title: '37: Normalize CRLF Offset Mapping in Volar Virtual Code'
status: ready
priority: medium
estimated: 2
actual: 0
assignee: ''
links:
  depends_on:
    - '[[029_cli_signal_handling]]'
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
