---
id: how-to-integration-testing
type: document
subtype: how-to
lifecycle: active
status: ready
title: Integration Testing Guide
description: Best practices for integration testing public APIs and cross-component workflows
---

{% raw %}

This guide provides best practices for writing integration tests in the templjs project, with emphasis on testing public API exports and avoiding common pitfalls.

## Overview

Integration tests verify that multiple components work together correctly. In templjs, we distinguish between:

1. **Unit Tests**: Test individual components in isolation (with mocked dependencies)
2. **Integration Tests**: Test multiple components together (with real implementations)
3. **Public API Tests**: Test exported package functions (no internal mocking)
4. **E2E Tests**: Test complete user workflows (CLI, file I/O, etc.)

## The Integration Testing Problem

### Common Failure Pattern

A work item can complete with all unit tests passing while the public API remains broken:

```typescript
// ✅ Implementation exists and passes tests
// src/renderer/renderer.ts
export class Renderer {
  render(ast: ASTNode, data: any): RenderResult {
    // ... 239 passing tests
  }
}

// ❌ Public API wrapper never updated
// src/index.ts
export function renderTemplate(template: string, data: any): string {
  throw new Error('Not yet implemented'); // Still a stub!
}

// ⚠️ Consumer tests use mocks, hiding the problem
// packages/cli/test/render.test.ts
vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(() => 'mocked'), // Never calls real function
}));
```

**Result**: All tests pass, but the actual CLI throws "Not yet implemented" in production.

## Integration Testing Principles

### 1. Test Real Implementations

**❌ Don't do this everywhere:**

```typescript
import { vi } from 'vitest';

// This mocks away the actual implementation
vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(),
  validateTemplate: vi.fn(),
}));
```

**✅ Do this for integration tests:**

```typescript
import { renderTemplate, validateTemplate } from '@templjs/core';

describe('Core Public API Integration', () => {
  it('renderTemplate processes template end-to-end', () => {
    // No mocking - tests the real implementation
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });
});
```

### 2. Mock Boundaries Correctly

**When to Mock:**

- External I/O (filesystem, network, database)
- System time/randomness
- Third-party services (Stripe, Auth0, etc.)
- Cross-package boundaries in consumer tests

**When NOT to Mock:**

- Public API functions being tested
- Internal package functions in integration tests
- Component chains (lexer → parser → renderer)

### 3. Test Organization

```text
packages/core/
├── src/
│   ├── lexer/
│   │   ├── lexer.ts
│   │   └── lexer.test.ts           # Unit: test lexer in isolation
│   ├── parser/
│   │   ├── parser.ts
│   │   └── parser.test.ts          # Unit: test parser in isolation
│   ├── renderer/
│   │   ├── renderer.ts
│   │   └── renderer.test.ts        # Unit: test renderer in isolation
│   └── index.ts                     # Public exports
├── test/
│   ├── integration/
│   │   ├── public-api.test.ts      # Integration: test exported functions
│   │   ├── lexer-parser.test.ts    # Integration: test lexer + parser
│   │   └── end-to-end.test.ts      # E2E: complete workflows
│   └── fixtures/
└── vitest.config.ts
```

## Patterns and Examples

### Pattern 1: Public API Integration Test

**Purpose**: Verify that exported wrapper functions properly delegate to internal implementations.

```typescript
// packages/core/test/integration/public-api.test.ts
import { describe, it, expect } from 'vitest';
import { renderTemplate, validateTemplate, tokenize, parse } from '@templjs/core';

describe('Public API Integration', () => {
  describe('renderTemplate', () => {
    it('renders simple variable expressions', () => {
      const result = renderTemplate('{{name}}', { name: 'Alice' });
      expect(result).toBe('Alice');
    });

    it('renders with filters', () => {
      const result = renderTemplate('{{name | upper}}', { name: 'alice' });
      expect(result).toBe('ALICE');
    });

    it('handles loops', () => {
      const template = '{% for item in items %}{{item}}{% endfor %}';
      const result = renderTemplate(template, { items: ['a', 'b', 'c'] });
      expect(result).toBe('abc');
    });
  });

  describe('validateTemplate', () => {
    it('accepts valid templates', () => {
      const result = validateTemplate('Hello {{name}}!');
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('detects syntax errors', () => {
      const result = validateTemplate('{{unclosed');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('tokenize + parse integration', () => {
    it('produces valid AST from tokens', () => {
      const tokens = tokenize('{{name}}');
      const parseResult = parse(tokens);

      expect(parseResult.ast).toBeDefined();
      expect(parseResult.errors).toHaveLength(0);
    });
  });
});
```

### Pattern 2: Cross-Package Integration Test

**Purpose**: Verify that CLI commands work with the core library (but mock file I/O).

```typescript
// packages/cli/test/integration/commands.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderCommand } from '../../src/commands/render';

// Mock only I/O operations
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Do NOT mock @templjs/core - use real implementation
import { readFileSync } from 'fs';

describe('CLI Commands Integration', () => {
  it('render command uses real core library', async () => {
    // Mock file reading
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (path === 'template.tmpl') return 'Hello {{name}}!';
      if (path === 'data.json') return '{"name": "World"}';
      throw new Error('Unexpected file');
    });

    // This internally calls the real renderTemplate from @templjs/core
    const result = await renderCommand('template.tmpl', 'data.json');

    expect(result).toBe('Hello World!');
  });
});
```

### Pattern 3: End-to-End Test

**Purpose**: Test complete workflows with actual CLI execution.

```typescript
// packages/cli/test/e2e/cli.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';

describe('CLI E2E', () => {
  it('renders template with file input', () => {
    // Create temporary files
    writeFileSync('/tmp/test.tmpl', 'Hello {{name}}!');
    writeFileSync('/tmp/test.json', '{"name": "World"}');

    try {
      // Run actual CLI
      const output = execSync('node dist/cli.js render -t /tmp/test.tmpl -i /tmp/test.json', {
        encoding: 'utf-8',
      });

      expect(output.trim()).toBe('Hello World!');
    } finally {
      unlinkSync('/tmp/test.tmpl');
      unlinkSync('/tmp/test.json');
    }
  });
});
```

## Work Item Testing Checklist

When implementing a work item that adds or modifies public exports:

### Before Implementation

- [ ] Review existing public API exports
- [ ] Identify which functions will be added/modified
- [ ] Plan integration test coverage

### During Implementation

- [ ] Write unit tests for new components (95%+ coverage)
- [ ] Write integration tests for component interactions
- [ ] Write public API tests for all exported functions

### Before PR Submission

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Public API tests verify real implementations (no mocking)
- [ ] Manual CLI/API verification completed
- [ ] No exported functions throw "not implemented" errors

### Code Review Focus

- [ ] Public API functions properly delegate to implementations
- [ ] Integration tests use real implementations
- [ ] Consumer tests use appropriate mock boundaries
- [ ] At least one E2E test covers the feature

## Common Pitfalls

### Pitfall 1: Testing the Mock Instead of the Implementation

```typescript
// ❌ BAD: This test passes even if renderTemplate is broken
vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(() => 'mocked output'),
}));

it('renders template', () => {
  const result = renderTemplate('{{name}}', { name: 'World' });
  expect(result).toBe('mocked output'); // Just testing the mock!
});
```

### Pitfall 2: No Integration Tests for Wrapper Functions

```typescript
// ❌ BAD: Unit tests pass, but wrapper is never tested
// src/index.ts
export function renderTemplate(template: string, data: any): string {
  throw new Error('Not implemented'); // Still a stub!
}

// src/renderer/renderer.test.ts - All passing ✅
describe('Renderer', () => {
  it('renders AST', () => {
    const renderer = new Renderer();
    // ... 239 tests pass
  });
});

// ✅ GOOD: Add integration test for the wrapper
// test/integration/public-api.test.ts
it('renderTemplate delegates to renderer', () => {
  const result = renderTemplate('{{name}}', { name: 'World' });
  expect(result).toBe('World'); // This would fail and catch the bug!
});
```

### Pitfall 3: Mocking Everything in Integration Tests

```typescript
// ❌ BAD: This isn't an integration test, it's still a unit test
vi.mock('../lexer');
vi.mock('../parser');
vi.mock('../renderer');

it('integration test', () => {
  // Not testing integration at all - everything is mocked!
});

// ✅ GOOD: Use real implementations
import { tokenize } from '../lexer';
import { parse } from '../parser';

it('lexer + parser integration', () => {
  const tokens = tokenize('{{name}}');
  const ast = parse(tokens);
  expect(ast.errors).toHaveLength(0);
});
```

## Testing Template

Use this template when adding new public API functions:

```typescript
// test/integration/public-api.test.ts
import { describe, it, expect } from 'vitest';
import { yourNewFunction } from '@templjs/core';

describe('yourNewFunction Integration', () => {
  it('handles basic case', () => {
    const result = yourNewFunction(/* args */);
    expect(result).toBe(/* expected */);
  });

  it('handles edge cases', () => {
    // Test error conditions, empty input, etc.
  });

  it('integrates with other components', () => {
    // Test how it works with lexer/parser/renderer
  });
});
```

## References

- [ADR-006: Testing Strategy](../adr/006-testing.md)
- [Vitest Documentation](https://vitest.dev/)
- [Work Item Manager Guide](../../backlog/AGENTS.md)

## Related Issues

This guide was created to prevent issues like:

- WI-007: Renderer implementation complete but `renderTemplate()` left as stub
- Tests all passing because they mocked the broken function
- Manual CLI testing revealed the bug only after PR review

{% endraw %}
