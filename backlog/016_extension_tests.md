---
id: wi-016
type: work-item
subtype: task
lifecycle: draft
title: '16: Write VS Code Extension Tests (50+ tests)'
status: proposed
priority: critical
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[012_volar_plugin]]'
    - '[[013_syntax_highlighting]]'
    - '[[014_diagnostics]]'
    - '[[015_intellisense]]'
---

## Goal

Comprehensive test coverage for VS Code extension features.

## Background

Tests validate:

- Language server activation
- Syntax highlighting
- Diagnostics collection and display
- IntelliSense (completion, hover)
- Virtual code mapping

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [ ] Setup VS Code Test Runner infrastructure
- [ ] Create `extensions/vscode/src/test/` directory
- [ ] Write extension activation tests
- [ ] Write syntax highlighting tests
- [ ] Write diagnostic collection tests
- [ ] Write completion tests
- [ ] Write hover tests
- [ ] Write go-to-definition tests
- [ ] Add integration tests (multi-file scenarios)
- [ ] Achieve 80%+ coverage

## Test Categories (50+ tests)

- **Activation** (5 tests): Extension loads, language registered
- **Syntax** (5 tests): Highlighting colors applied
- **Diagnostics** (15 tests): Errors detected, positions correct
- **Completion** (10 tests): Suggestions shown, filtering works
- **Hover** (10 tests): Tooltips displayed, types shown
- **Integration** (5 tests): Multi-file scenarios

## Deliverables

- 50+ passing VS Code tests
- 80%+ code coverage for extension
- Test utilities for common scenarios
- CI/CD integration

## Acceptance Criteria

- [ ] All 50+ tests passing
- [ ] Coverage report shows 80%+ line coverage
- [ ] Extension tests run in CI/CD
- [ ] No flaky tests (deterministic)
- [ ] Integration tests passing

## Example Test

```typescript
suite('Extension Activation', () => {
  test('should activate on .tmpl files', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'templated-markdown',
      content: '{{ user.name }}',
    });
    await vscode.window.showTextDocument(doc);

    const ext = vscode.extensions.getExtension('templjs.vscode-templjs');
    expect(ext?.isActive).toBe(true);
  });
});
```

## Run Tests

```bash
cd extensions/vscode
npm run test
```

## References

- [VS Code Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Vitest Documentation](https://vitest.dev/)

## Dependencies

- Requires: [[13 Syntax Highlighting]], [[14 Diagnostics]], [[15 IntelliSense]]
- Unblocks: [[17 Implement CLI Commands]] (extension complete)
