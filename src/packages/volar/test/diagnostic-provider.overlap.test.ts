import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/expression-analysis.js', () => ({
  extractExpressionVariableReferences: () => [
    {
      path: 'items',
      start: 0,
      end: 5,
    },
  ],
  extractExpressionFilterReferences: () => [
    {
      name: 'items',
      start: 0,
      end: 5,
    },
  ],
}));

const { collectDiagnostics } = await import('../src/diagnostic-provider.js');

describe('DiagnosticProvider overlap handling', () => {
  it('skips variable validation for references that overlap filter ranges in for iterables', () => {
    const diagnostics = collectDiagnostics('{% for item in items %}ok{% endfor %}', {
      schema: {
        type: 'object',
        properties: {},
      },
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });
});
