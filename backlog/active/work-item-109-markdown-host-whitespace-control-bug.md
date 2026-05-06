---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:109-markdown-host-whitespace-control-bug
title: '109: Fix whitespace control bug in markdown template cleaning'
summary: Fix whitespace control (`{% -%}` / `{%- %}`) not properly trimming trailing/leading newlines from adjacent template content.
type: work-item
subtype: bug
lifecycle: active
status: ready
priority: high
estimated: 2
actual: 0
---

## Goal

Ensure that whitespace control delimiters (`{%- -%}`, `{%- %}`, `{% -%}`) correctly trim trailing and leading newlines from adjacent template regions.

## Background

PoC testing revealed that `{% -%}` is not trimming the trailing newline as expected. The lexer handles whitespace control by mutating adjacent TEXT tokens, but the cleaned output and diagnostics show incorrect behavior. WI-105 drives the larger tokenizer error-tolerance and fallback elimination initiative; this bug fix is a focused delivery on a specific observed failure.

## Scope

- Identify the exact whitespace control behavior failure in the lexer.
- Fix TEXT token mutation for `{%- %}` and `{% -%}` cases.
- Add regression test fixtures that validate correct trimming.
- Verify diagnostic offset mapping remains correct after fix.

## Tasks

- [ ] Reproduce the `{% -%}` trailing newline trimming failure with a minimal fixture.
- [ ] Verify lexer whitespace control logic in TEXT token mutation.
- [ ] Fix the trimming behavior to correctly remove trailing/leading newlines.
- [ ] Add regression fixtures for all whitespace control variants (`{%-`, `-%}`, `{%- -%}`).
- [ ] Validate that diagnostic ranges remain correct in cleaned output.

## Deliverables

- Fixed lexer whitespace control behavior.
- Regression test fixtures for all control delimiter patterns.

## Acceptance Criteria

- [ ] `{% -%}` correctly trims trailing newlines from adjacent content.
- [ ] All whitespace control variants (`{%-`, `-%}`, `{%- -%}`) produce correct output.
- [ ] Diagnostic offset mapping remains stable.
- [ ] Build/test and frontmatter validation pass.

## Relationships

- `related_to`: [[work-item-105-tokenizer-error-tolerance-and-regex-fallback-elimination]]
