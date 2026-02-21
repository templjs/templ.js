---
id: wi-019
type: work-item
subtype: task
lifecycle: draft
title: '19: Write CLI Tests (50+ tests)'
status: proposed
priority: critical
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[017_cli_commands]]'
    - '[[018_cli_watch_mode]]'
    - '[[029_cli_signal_handling]]'
---

## Goal

Comprehensive test coverage for CLI functionality.

## Background

Tests validate:

- Command parsing and execution
- Input/output handling (file and stdin/stdout)
- Error reporting
- Configuration loading
- Watch mode behavior

**Related ADRs**: [[ADR-006 Testing Strategy]]

## Tasks

- [ ] Create `packages/cli/tests/` test directory
- [ ] Write command parsing tests
- [ ] Write input format detection tests
- [ ] Write output generation tests
- [ ] Write file I/O tests
- [ ] Write config loading tests
- [ ] Write error handling tests
- [ ] Add integration tests (end-to-end CLI scenarios)
- [ ] Achieve 90%+ coverage

## Test Categories (50+ tests)

- **Commands** (15 tests): Parsing, execution, help text
- **Input/Output** (15 tests): File reading, stdout/stdin, formats
- **Config** (10 tests): Loading, merging, precedence
- **Errors** (5 tests): Error handling, user messaging
- **Integration** (5 tests): Full CLI scenarios

## Deliverables

- 50+ passing CLI tests
- 90%+ code coverage
- Test fixtures (sample data, templates)
- Integration test scenarios

## Acceptance Criteria

- [ ] All 50+ tests passing
- [ ] Coverage report shows 90%+ line coverage
- [ ] All commands tested
- [ ] Error cases covered
- [ ] Integration tests passing

## Example Tests

```typescript
describe('CLI render command', () => {
  it('should render template with JSON input', async () => {
    const result = await runCLI('render', {
      input: 'test-data.json',
      template: 'test-template.md.tmpl',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('expected output');
  });

  it('should handle missing template file', async () => {
    const result = await runCLI('render', {
      input: 'test-data.json',
      template: 'missing.tmpl',
    });
    expect(result.exitCode).toBeGreaterThan(0);
    expect(result.stderr).toContain('not found');
  });
});
```

## Run Tests

```bash
nx test cli --coverage
```

## References

- [Vitest CLI Testing](https://vitest.dev/getting-started.html)

## Dependencies

- Requires: [[17 Implement CLI Commands]], [[18 Add Watch Mode and File I/O]]
- Unblocks: [[20 Write Documentation]]
