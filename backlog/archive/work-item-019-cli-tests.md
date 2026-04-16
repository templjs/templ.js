---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:019-cli-tests
title: '19: Write CLI Tests (50+ tests)'
summary: Write CLI Tests (50+ tests)
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: merged_to_main
priority: critical
estimated: 8
actual: 8
commits:
  19e89fd: 'feat(cli): implement render/validate/init commands (#18)'
  646371e: 'test(cli): cover watch mode edge cases and coverage gaps'
  c345727: 'feat(cli): implement WI-029 signal handling, TTY detection, error formatting, and streaming I/O (#23)'
  8b4673f: 'test(cli): close WI-034 per-file coverage gates for CLI package'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/18
    - https://github.com/templjs/templ.js/pull/22
    - https://github.com/templjs/templ.js/pull/23
  evidence:
    - '[[record-019-cli-tests-evidence-1]]'
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

- [x] Create `packages/cli/tests/` test directory
- [x] Write command parsing tests
- [x] Write input format detection tests
- [x] Write output generation tests
- [x] Write file I/O tests
- [x] Write config loading tests
- [x] Write error handling tests
- [x] Add integration tests (end-to-end CLI scenarios)
- [x] Achieve 90%+ coverage

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

- [x] All 50+ tests passing
- [x] Coverage report shows 90%+ line coverage
- [x] All commands tested
- [x] Error cases covered
- [x] Integration tests passing

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
pnpm --filter @templjs/cli test -- --coverage
```

## References

- [Vitest CLI Testing](https://vitest.dev/getting-started.html)

## Dependencies

- Requires: [[17 Implement CLI Commands]], [[18 Add Watch Mode and File I/O]]
- Unblocks: [[20 Write Documentation]]

## Relationships

- `depends_on`: [[work-item-017-cli-commands]]
- `depends_on`: [[work-item-018-cli-watch-mode]]
- `depends_on`: [[work-item-029-cli-signal-handling]]
