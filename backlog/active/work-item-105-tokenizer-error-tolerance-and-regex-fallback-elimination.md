---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:105-tokenizer-error-tolerance-and-regex-fallback-elimination
title: '105: Make tokenize() error-tolerant and eliminate the Volar regex fallback'
summary: Refactor the core tokenizer to emit partial tokens and recover from unclosed delimiters rather than throwing, and extend cleanTemplateContent with an optional replacement-text parameter (default ''), allowing it to drop its regex fallback and rely solely on tokenize() for correct, position-accurate cleaning.
type: work-item
subtype: task
lifecycle: active
status: ready
priority: medium
estimated: 5
actual: 0
---

## Goal

Replace the throw-on-error behaviour in `@templjs/core`'s `tokenize()` with error-tolerant partial-token emission, and fix `cleanTemplateContent` in `@templjs/volar` to **delete** non-TEXT tokens and emit a real `originalToCleanedOffsets` mapping (not the current identity map). Whitespace controls (`{%- -%}`) are already handled by the lexer in adjacent TEXT tokens and require no extra work in the cleaner. The function should be simplified to a single tokenizer-based code path with no regex reimplementation.

## Background

`cleanTemplateContent` currently uses a two-path strategy:

1. **Primary path** — runs `tokenize()` from `@templjs/core` and **space-pads** non-TEXT tokens (preserving newlines). This keeps the cleaned length equal to the source length so an identity `originalToCleanedOffsets` works, but it is semantically wrong: the cleaned output is not valid base-format content and produces false diagnostics.
2. **Regex fallback** — an independent regex-based reimplementation that activates whenever `tokenize()` throws (e.g., `Error: Unclosed statement starting at…`).

The fallback is necessary today because any document with an in-progress template tag (e.g., the user just typed `{%` but has not yet closed `%}`) causes `tokenize()` to throw, producing zero diagnostics — a poor editing experience.

### Correct semantics: deletion + real offset mapping

Non-TEXT tokens should be **deleted** from the cleaned output. The `originalToCleanedOffsets` array must be a real, non-identity mapping:

- Every source character **inside** a token maps to the offset of that token's start in cleaned text (they compress to a point).
- Every source character **after** a token maps to `cleanedOffset − totalDeletedChars`.

`CleanedTemplateResult.cleaned` then contains only TEXT-token content, which is the valid base-format text the host language server should see.

### Whitespace controls

The lexer already handles `{%- -%}` whitespace controls: it mutates the adjacent TEXT token's content to strip trailing/leading whitespace before emitting it. After tokenizing, TEXT tokens already reflect the trimmed result. The cleaner only emits TEXT tokens as-is — no extra whitespace-control logic is needed.

### Optional replacement text

The cleaner should still accept an optional `replacement?: string` parameter (default `''`) so callers can inject a placeholder (e.g., a single space, a sentinel string) for testing or preview purposes. Newline characters within deleted regions are always preserved — emitting them as bare `\n` characters — to avoid collapsing multi-line spans and to keep line numbers stable.

## Scope

- `src/packages/core/src/lexer/lexer.ts`: Add recovery logic for unclosed delimiter sequences.
- `src/packages/core/src/lexer/lexer.test.ts` (or co-located test file): Add test cases for partial/malformed templates.
- `src/packages/volar/src/index.ts`: Remove `cleanWithRegexFallback` and the try/catch wrapper in `cleanTemplateContent`; replace with a direct call to `cleanWithCoreTokenizer`. Extend the `cleanTemplateContent` signature with `replacement?: string` (default `''`); thread the parameter through to `cleanWithCoreTokenizer`.
- `src/packages/volar/src/index.test.ts` (or co-located): Update/add tests for `cleanTemplateContent` against malformed input.

## Tasks

- [ ] Define the recovery contract for `tokenize()`: choose between (a) emitting an `ERROR` token for unrecognised/unclosed content or (b) treating remaining text as TEXT tokens, and document the decision.
- [ ] Implement error-tolerant recovery in the lexer; ensure output token stream always covers the full input length.
- [ ] Add unit tests in `@templjs/core` covering: unclosed `{%`, unclosed `{{`, nested/interleaved delimiters, empty input, and delimiter-only input.
- [ ] Rewrite `cleanWithCoreTokenizer` to delete non-TEXT tokens and build a real `originalToCleanedOffsets` mapping (source offset → cleaned offset for each character).
- [ ] Preserve bare `\n` characters from within deleted token regions to keep line numbers stable; `\r` and other characters within tokens are dropped.
- [ ] Verify that `cleanWithCoreTokenizer` produces correct offset-preserving output for all recovery cases, including whitespace-controlled tags.
- [ ] Add `replacement?: string` parameter to `cleanWithCoreTokenizer` and `cleanTemplateContent`; default to `''`; always preserve newlines within deleted regions regardless of `replacement` value.
- [ ] Add unit tests for `replacement` parameter: empty string default, custom string, and newline-preservation within multi-line token regions.
- [ ] Remove `cleanWithRegexFallback` from `src/packages/volar/src/index.ts`.
- [ ] Remove try/catch wrapper in `cleanTemplateContent`; make it a direct delegation to `cleanWithCoreTokenizer`.
- [ ] Run `pnpm --filter @templjs/core test` and `pnpm --filter @templjs/volar test` to confirm no regressions.
- [ ] Run `pnpm --dir src/extensions/vscode run test:host` to confirm host diagnostics still pass.
- [ ] Create a changeset entry covering `@templjs/core` and `@templjs/volar` (both receive a `minor` or `patch` bump as appropriate).

## Deliverables

- Updated `tokenize()` with documented recovery behaviour.
- Simplified `cleanTemplateContent` with single code path and `replacement?: string` parameter.
- Test coverage for malformed/partial templates and `replacement` parameter variants in both packages.
- Changeset entry.

## Acceptance Criteria

- [ ] `tokenize()` no longer throws for any input; it always returns a token stream covering the full source length.
- [ ] `cleanTemplateContent` contains no regex-based fallback path.
- [ ] `cleanTemplateContent` deletes non-TEXT tokens and emits a real (non-identity) `originalToCleanedOffsets` map.
- [ ] `cleanTemplateContent` accepts `replacement?: string` (default `''`); newlines within deleted regions are always preserved regardless of `replacement`.
- [ ] Whitespace controls (`{%- -%}`) produce correct cleaned output without additional logic in the cleaner (lexer already trims adjacent TEXT tokens).
- [ ] All existing `@templjs/core` and `@templjs/volar` tests pass.
- [ ] Host extension diagnostics tests pass (5/6 minimum; hover failure pre-existing and out of scope).
- [ ] No change in diagnostic accuracy for well-formed templates (non-regression).
- [ ] Lint and frontmatter validation pass.
