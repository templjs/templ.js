---
id: adr-006
type: document
subtype: architecture-decision
lifecycle: active
status: ready
title: 'ADR-006: Testing Strategy (Vitest)'
---

## Status

Accepted - February 2026

## Context

The Python Temple project has comprehensive test coverage:

- **800+ tests** across tokenizer, parser, renderer, linter
- **80%+ coverage** with pytest
- **Test Types**: Unit tests, integration tests, snapshot tests

### Requirements for TypeScript Testing

1. **Fast Execution**: <5s for unit tests, <30s for full suite
2. **TypeScript Native**: First-class TypeScript support
3. **VS Code Integration**: Run tests directly in editor
4. **Watch Mode**: Auto-rerun tests on file changes
5. **Coverage Reporting**: Maintain 90%+ coverage
6. **Snapshot Testing**: For AST and rendered output validation

### Testing Framework Options

| Framework        | Pros                                                           | Cons                       |
| ---------------- | -------------------------------------------------------------- | -------------------------- |
| **Vitest**       | ⭐ Fast (Vite-powered), TypeScript-native, Jest-compatible API | Newer ecosystem            |
| **Jest**         | Battle-tested, huge ecosystem, snapshot testing                | Slower, requires ts-jest   |
| **Mocha + Chai** | Flexible, established                                          | Manual setup, no snapshots |
| **AVA**          | Parallel by default, TypeScript support                        | API differences from Jest  |

## Decision

**Use Vitest as primary testing framework with VS Code Test Runner integration.**

### Architecture

```bash ascii-tree
templjs/templ.js/
├── vitest.config.ts           # Root config with shared settings
├── packages/
│   ├── core/
│   │   ├── vitest.config.ts   # Extends root config
│   │   ├── src/
│   │   │   ├── lexer.ts
│   │   │   └── lexer.test.ts  # Co-located tests
│   │   └── tests/
│   │       ├── integration/
│   │       └── fixtures/
│   ├── cli/
│   │   └── tests/
│   └── volar/
│       └── tests/
└── extensions/
    └── vscode/
        └── src/test/          # VS Code extension tests
```

### Test Categories

#### 1. Unit Tests (Vitest)

**Location**: `*.test.ts` files co-located with source
**Scope**: Individual functions, classes, modules
**Example**:

```typescript
// src/lexer.test.ts
import { describe, it, expect } from 'vitest';
import { tokenize } from './lexer';

describe('Lexer', () => {
  it('should tokenize simple expression', () => {
    const tokens = tokenize('{{ user.name }}');
    expect(tokens).toMatchSnapshot();
  });
});
```

#### 2. Integration Tests (Vitest)

**Location**: `tests/integration/` directories
**Scope**: Multi-module interactions, end-to-end workflows
**Example**:

```typescript
// tests/integration/render.test.ts
import { describe, it, expect } from 'vitest';
import { parse } from '@templjs/core';
import { render } from '@templjs/core';

describe('Parse + Render', () => {
  it('should render markdown template', async () => {
    const template = '# {{ title }}\n{{ content }}';
    const ast = parse(template);
    const output = await render(ast, { title: 'Hello', content: 'World' });
    expect(output).toBe('# Hello\nWorld');
  });
});
```

#### 3. VS Code Extension Tests

**Location**: `extensions/vscode/src/test/`
**Framework**: VS Code Test Runner + Vitest
**Scope**: Language server features, diagnostics, completions
**Example**:

```typescript
// extensions/vscode/src/test/diagnostics.test.ts
import * as vscode from 'vscode';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Diagnostics', () => {
  beforeAll(async () => {
    await vscode.extensions.getExtension('templjs.vscode-templjs')?.activate();
  });

  it('should report missing variable', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'templated-markdown',
      content: '{{ undefined_var }}',
    });
    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('undefined_var');
  });
});
```

## Coverage Strategy

### Target Metrics

- **Overall**: 90%+ coverage
- **Core Library**: 95%+ (parser, renderer, query engine)
- **CLI**: 85%+ (command handlers, I/O)
- **Volar Plugin**: 80%+ (language service)

### Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/*.test.ts', '**/fixtures/**', '**/dist/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
```

## Test Migration from Python

### Porting Strategy

1. **Tokenizer Tests** (200+ tests) → `packages/core/src/lexer.test.ts`
2. **Parser Tests** (300+ tests) → `packages/core/src/parser.test.ts`
3. **Renderer Tests** (200+ tests) → `packages/core/src/renderer.test.ts`
4. **Linter Tests** (100+ tests) → `packages/volar/tests/diagnostics.test.ts`

### Example Port

**Python (pytest):**

```python
def test_tokenize_expression():
    tokens = tokenize('{{ user.name }}')
    assert tokens[0].type == TokenType.EXPRESSION
    assert tokens[0].value == 'user.name'
```

**TypeScript (Vitest):**

```typescript
it('should tokenize expression', () => {
  const tokens = tokenize('{{ user.name }}');
  expect(tokens[0].type).toBe(TokenType.EXPRESSION);
  expect(tokens[0].value).toBe('user.name');
});
```

## Performance Targets

| Metric                 | Target | Command              |
| ---------------------- | ------ | -------------------- |
| **Unit Tests**         | <5s    | `nx test core`       |
| **Full Suite**         | <30s   | `nx test --all`      |
| **Watch Mode Restart** | <500ms | `nx test --watch`    |
| **Coverage Report**    | <10s   | `nx test --coverage` |

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: nx affected:test --coverage
      - uses: codecov/codecov-action@v3
```

## Consequences

### Positive

1. **Speed**: Vitest is 10x faster than Jest for TypeScript
2. **DX**: Hot module reload in watch mode
3. **TypeScript**: No transpilation config needed
4. **API Compatibility**: Jest-compatible API eases migration
5. **Snapshot Testing**: Built-in snapshot support
6. **VS Code Integration**: Native test runner support

### Negative

1. **Ecosystem Maturity**: Vitest is newer (2021) vs Jest (2014)
2. **Plugin Ecosystem**: Smaller plugin ecosystem than Jest
3. **Learning Curve**: Team must learn Vitest-specific features

### Neutral

- **Migration Effort**: ~2 weeks to port 800+ Python tests
- **Coverage Tooling**: v8 coverage vs pytest-cov

## Commands

```bash
# Run tests
pnpm test                      # Run all tests
nx test core                   # Test single package
nx affected:test               # Test affected by changes

# Watch mode
nx test core --watch           # Auto-rerun on changes

# Coverage
nx test --coverage             # Generate coverage report
nx affected:test --coverage    # Coverage for affected

# Debugging
nx test --inspect-brk          # Debug with Chrome DevTools
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [VS Code Test Runner API](https://code.visualstudio.com/api/extension-guides/testing)
- [Jest-to-Vitest Migration Guide](https://vitest.dev/guide/migration.html)
