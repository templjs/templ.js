import { describe, expect, it } from 'vitest';
import {
  collectDiagnostics,
  DiagnosticSeverity,
  remapDiagnosticsToOriginal,
} from './diagnostic-provider';

const sampleSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name'],
    },
    users: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      },
    },
  },
};

describe('DiagnosticProvider', () => {
  it('reports missing closing end tag', () => {
    const diagnostics = collectDiagnostics('{% if user.name %}\nHello', {
      schema: sampleSchema,
    });
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(true);
  });

  it('reports unexpected closing tag', () => {
    const diagnostics = collectDiagnostics('{% endif %}');
    expect(diagnostics[0]?.code).toBe('templjs.unexpectedClosing');
  });

  it('reports unclosed statement delimiter', () => {
    const diagnostics = collectDiagnostics('Start {% if user.name');
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatementDelimiter')).toBe(
      true
    );
  });

  it('reports unclosed expression delimiter', () => {
    const diagnostics = collectDiagnostics('Hello {{ user.name');
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedExpressionDelimiter')).toBe(
      true
    );
  });

  it('ignores template syntax inside comments', () => {
    const diagnostics = collectDiagnostics('{# {{ bad }} {% if %} #}');
    expect(diagnostics.length).toBe(0);
  });

  it('reports undefined variables in expressions', () => {
    const diagnostics = collectDiagnostics('{{ unknown.value }}', { schema: sampleSchema });
    expect(diagnostics[0]?.code).toBe('templjs.undefinedVariable');
  });

  it('provides suggestions for undefined variables', () => {
    const diagnostics = collectDiagnostics('{{ usr.name }}', { schema: sampleSchema });
    expect(diagnostics[0]?.suggestion).toBeDefined();
  });

  it('does not flag valid variables', () => {
    const diagnostics = collectDiagnostics('{{ user.name }}', { schema: sampleSchema });
    expect(diagnostics.length).toBe(0);
  });

  it('validates for-in variables', () => {
    const diagnostics = collectDiagnostics('{% for user in unknowns %}', {
      schema: sampleSchema,
    });
    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(true);
  });

  it('flags invalid filters', () => {
    const diagnostics = collectDiagnostics('{{ user.name | unknown }}');
    expect(diagnostics[0]?.code).toBe('templjs.invalidFilter');
  });

  it('accepts custom filters', () => {
    const diagnostics = collectDiagnostics('{{ user.name | custom }}', {
      customFilters: ['custom'],
    });
    expect(diagnostics.length).toBe(0);
  });

  it('reports multiple errors', () => {
    const diagnostics = collectDiagnostics('Hello {{ missing }} {% if user.name %}', {
      schema: sampleSchema,
    });
    expect(diagnostics.length).toBeGreaterThan(1);
  });

  it('handles nested statements correctly', () => {
    const diagnostics = collectDiagnostics('{% if user.name %}{% for u in users %}X');
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(true);
  });

  it('handles empty input gracefully', () => {
    const diagnostics = collectDiagnostics('');
    expect(diagnostics.length).toBe(0);
  });

  it('handles text without templates', () => {
    const diagnostics = collectDiagnostics('Plain text only.');
    expect(diagnostics.length).toBe(0);
  });

  it('supports custom delimiters', () => {
    const diagnostics = collectDiagnostics('<< if user.name >>', {
      delimiters: {
        statementStart: '<<',
        statementEnd: '>>',
        expressionStart: '<:',
        expressionEnd: ':>',
        commentStart: '<#',
        commentEnd: '#>',
      },
    });
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(true);
  });

  it('assigns error severity for invalid filters', () => {
    const diagnostics = collectDiagnostics('{{ user.name | unknown }}');
    expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
  });

  it('assigns error severity for undefined variables', () => {
    const diagnostics = collectDiagnostics('{{ unknown }}', { schema: sampleSchema });
    expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
  });

  it('returns diagnostic ranges with valid positions', () => {
    const diagnostics = collectDiagnostics('Hello {{ unknown }}', { schema: sampleSchema });
    const range = diagnostics[0]?.range;
    expect(range?.start.line).toBeGreaterThanOrEqual(0);
    expect(range?.start.character).toBeGreaterThanOrEqual(0);
  });

  it('remaps base diagnostics to original positions', () => {
    const original = 'Hello {{ name }}\nWorld';
    const baseDiagnostics = [
      {
        message: 'Base error',
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 11 },
        },
        severity: DiagnosticSeverity.Error,
      },
    ];
    const remapped = remapDiagnosticsToOriginal(original, baseDiagnostics);
    expect(remapped[0]?.range.start.line).toBe(0);
    expect(remapped[0]?.range.start.character).toBe(6);
  });

  it('remaps base diagnostics across multiline templates', () => {
    const original = 'Start\n{% if user.name %}\nMiddle\n{% endif %}\nEnd';
    const baseDiagnostics = [
      {
        message: 'Base error',
        range: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 6 },
        },
        severity: DiagnosticSeverity.Error,
      },
    ];
    const remapped = remapDiagnosticsToOriginal(original, baseDiagnostics);
    expect(remapped[0]?.range.start.line).toBe(2);
  });

  it('preserves diagnostic messages during remap', () => {
    const original = 'Hello {{ name }}';
    const baseDiagnostics = [
      {
        message: 'Base issue',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        severity: DiagnosticSeverity.Error,
      },
    ];
    const remapped = remapDiagnosticsToOriginal(original, baseDiagnostics);
    expect(remapped[0]?.message).toBe('Base issue');
  });

  it('skips validation when schema is missing', () => {
    const diagnostics = collectDiagnostics('{{ user.name }}');
    expect(diagnostics.length).toBe(0);
  });

  it('flags missing end tag even with expression errors', () => {
    const diagnostics = collectDiagnostics('{% if user.name %} {{ unknown }}', {
      schema: sampleSchema,
    });
    const codes = diagnostics.map((diag) => diag.code);
    expect(codes).toContain('templjs.unclosedStatement');
    expect(codes).toContain('templjs.undefinedVariable');
  });

  it('handles multiple expressions in one line', () => {
    const diagnostics = collectDiagnostics('{{ unknown }} {{ user.name }}', {
      schema: sampleSchema,
    });
    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(true);
  });

  it('allows valid filters', () => {
    const diagnostics = collectDiagnostics('{{ user.name | upper }}');
    expect(diagnostics.length).toBe(0);
  });

  it('detects missing closing for expression delimiters', () => {
    const diagnostics = collectDiagnostics('Value: {{ user.name');
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedExpressionDelimiter')).toBe(
      true
    );
  });

  it('detects missing closing for statement delimiters', () => {
    const diagnostics = collectDiagnostics('Value: {% if user.name');
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatementDelimiter')).toBe(
      true
    );
  });

  it('does not treat text between delimiters as filters when no pipe', () => {
    const diagnostics = collectDiagnostics('{{ user.name }}');
    expect(diagnostics.length).toBe(0);
  });

  it('supports mixed valid and invalid filters', () => {
    const diagnostics = collectDiagnostics('{{ user.name | upper | unknown }}');
    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidFilter')).toBe(true);
  });

  it('reports errors with suggestions for for-in variables', () => {
    const diagnostics = collectDiagnostics('{% for item in usr %}', {
      schema: sampleSchema,
    });
    expect(diagnostics[0]?.suggestion).toBeDefined();
  });

  it('handles repeated variable validation in expressions', () => {
    const diagnostics = collectDiagnostics('{{ user.name }} {{ user.name }}', {
      schema: sampleSchema,
    });
    expect(diagnostics.length).toBe(0);
  });

  it('supports custom delimiters for expressions', () => {
    const diagnostics = collectDiagnostics('<: user.name :>', {
      delimiters: {
        expressionStart: '<:',
        expressionEnd: ':>',
      },
      schema: sampleSchema,
    });
    expect(diagnostics.length).toBe(0);
  });
});
