---
$schema: schemas/work-management/frontmatter/record.json
id: record:095-host-language-authoring-delegation-evidence-1
title: '095: Host-language highlighting and authoring delegation evidence'
summary: Captures WI-095 validation for live embedded host-language scopes and delegated completion/hover behavior in tmpl host formats
type: record
subtype: evidence
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-05-13T19:39:09Z

## Outcome

passed

## Observation

### Delegation and Grammar Wiring

- Verified all host injection grammars emit live embedded wrapper scopes:
  - `meta.embedded.block.markdown`
  - `meta.embedded.block.html`
  - `meta.embedded.block.json`
  - `meta.embedded.block.yaml`
- Added cross-format TextMate regression coverage in `src/extensions/vscode/test/textmate-harness.test.ts` to prevent dead-scope regressions in `embeddedLanguages` routing.
- Existing focused tests continue to verify templjs overlay scope tokenization in markdown/yaml host grammars.

### Extension Host Validation

- Extension-host capability matrix remains green for hover/completion/definition/format/diagnostics flows.
- Host diagnostics suite confirms language associations for markdown/html/json/yaml template files and validates zero templjs diagnostics for known-good fixtures.

### Validation Evidence

- `rtk pnpm --dir src/extensions/vscode run test -- test/textmate-harness.test.ts`
  - passed (`13` test files, `131` tests).
- `rtk pnpm --dir src/extensions/vscode run test:host`
  - passed (`18` extension-host tests).

## Subject References

- [[work-item-095-bug-syntax-highlighting-autocomplete-hover-not-working]]

## Artifact References

- [TextMate host scope harness test](../../src/extensions/vscode/test/textmate-harness.test.ts)
- [Extension host capabilities suite](../../src/extensions/vscode/test/extension-host/capabilities.test.js)
- [Host diagnostics suite](../../src/extensions/vscode/test/extension-host/diagnostics.test.js)
