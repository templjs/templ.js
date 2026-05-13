---
$schema: schemas/work-management/frontmatter/record.json
id: record:106-delegation-only-diagnostics-evidence-1
title: '106: Delegation-only diagnostics completion evidence'
summary: Captures WI-106 completion evidence for removing extension-host markdownlint runtime probing and validating delegated host diagnostics behavior
type: record
subtype: evidence
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-05-13T18:58:42Z

## Outcome

passed

## Observation

### Extension Host Delegation-Only Runtime

- Removed extension-host markdownlint binary probing from `src/extensions/vscode/src/extension.ts`.
- Forced `templjs-markdownlint-host` runtime state to `unavailable` at extension initialization so host diagnostics remain delegation-only.
- Kept runtime map resolution for transport-level initialization while preventing markdownlint subprocess diagnostics from the extension host path.

### Host Diagnostics Fixture Correction

- Updated `src/extensions/vscode/test-fixtures/deploy.yaml.tmpl` loop syntax to avoid a VS Code authoring-path statement-shape validation failure in host tests.
- This resolves the failing `test:host` assertion that expected zero templjs diagnostics for a valid fixture without changing core template-language support claims.

### Validation Evidence

- `rtk pnpm --dir src/extensions/vscode run test -- test/extension.test.ts test/extension.host-language-delegation.test.ts`
  - passed (`13` test files, `130` tests).
- `rtk pnpm --filter @templjs/volar test`
  - passed (`18` test files, `581` tests).
- `rtk pnpm --dir src/extensions/vscode run test:host`
  - passed (`18` extension-host tests).

## Subject References

- [[work-item-106-remove-inprocess-yaml-service-and-delegate-to-volar-virtual-code]]

## Artifact References

- [Extension host runtime wiring](../..//src/extensions/vscode/src/extension.ts)
- [Extension helper tests](../..//src/extensions/vscode/test/extension.test.ts)
- [Host diagnostics fixture](../..//src/extensions/vscode/test-fixtures/deploy.yaml.tmpl)
