import { describe, expect, it } from 'vitest';
import {
  collectDiagnostics,
  DiagnosticSeverity,
  remapDiagnosticsToOriginal,
  resolveScopedPathInText,
} from '../src/diagnostic-provider.js';

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

const frontmatterSchema = {
  type: 'object',
  properties: {
    front: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    },
  },
};

const contentSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'object',
      properties: {
        heading: { type: 'string' },
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

  it('reports invalid for statements', () => {
    const diagnostics = collectDiagnostics('{% for x in %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
  });

  it('reports invalid for statement with whitespace-control marker', () => {
    // -%} strips trailing whitespace; the `-` must not be mistaken for expression content
    const diagnostics = collectDiagnostics('{% for x in -%}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
  });

  it('does not flag valid for statement with whitespace-control marker', () => {
    const diagnostics = collectDiagnostics('{% for x in items -%}{% endfor %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(false);
  });

  it('reports invalid if statements', () => {
    const diagnostics = collectDiagnostics('{% if %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(true);
  });

  it('does not flag local set/loop variables as undefined in malformed templates', () => {
    const text = [
      '---',
      '"$schema": "./example.schema.json",',
      'invalid: bar: [{% if %}foo {% endif %}]',
      '---',
      '# Title',
      '{% set collection = ["a", "b"] %}',
      '{% for x in collection -%}',
      '{{ x }}',
    ].join('\n');

    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });

    expect(
      diagnostics.some(
        (diag) =>
          diag.code === 'templjs.undefinedVariable' &&
          diag.message.includes('"collection" not found in schema')
      )
    ).toBe(false);
    expect(
      diagnostics.some(
        (diag) =>
          diag.code === 'templjs.undefinedVariable' &&
          diag.message.includes('"x" not found in schema')
      )
    ).toBe(false);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unexpectedClosing')).toBe(false);
  });

  it('reports invalid if statement with whitespace-control marker', () => {
    const diagnostics = collectDiagnostics('{%- if -%}', { schema: sampleSchema });
    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('anchors invalid for-statement range to for keyword with trim markers', () => {
    const diagnostics = collectDiagnostics('{%- for x in -%}', {
      schema: sampleSchema,
    });

    const invalidFor = diagnostics.find((diag) => diag.code === 'templjs.invalidStatement');
    expect(invalidFor).toBeDefined();
    expect(invalidFor?.range.start.line).toBe(0);
    expect(invalidFor?.range.start.character).toBe(4);
  });

  it('reports invalid while statements', () => {
    const diagnostics = collectDiagnostics('{% while %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('accepts valid while and switch statements with expressions', () => {
    const whileDiagnostics = collectDiagnostics('{% while user.active %}', {
      schema: sampleSchema,
    });
    const switchDiagnostics = collectDiagnostics('{% switch user.role %}', {
      schema: sampleSchema,
    });

    expect(whileDiagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(false);
    expect(switchDiagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(false);
  });

  it('reports invalid switch statements', () => {
    const diagnostics = collectDiagnostics('{% switch %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('reports invalid switch statement with whitespace-control marker', () => {
    const diagnostics = collectDiagnostics('{% switch -%}', { schema: sampleSchema });
    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('reports invalid block statements', () => {
    const diagnostics = collectDiagnostics('{% block %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('reports invalid set statements', () => {
    const diagnostics = collectDiagnostics('{% set %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
  });

  it('reports invalid set statement with whitespace-control marker', () => {
    const diagnostics = collectDiagnostics('{%- set -%}', { schema: sampleSchema });
    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('reports invalid set statement with missing right-hand expression after equals', () => {
    const diagnostics = collectDiagnostics('{% set foo = %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('does not emit unclosedStatement for valid set', () => {
    const diagnostics = collectDiagnostics('{% set foo = bar %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
  });

  it('reports invalid case statements', () => {
    const diagnostics = collectDiagnostics('{% case %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
  });

  it('reports invalid case statement with whitespace-control marker', () => {
    const diagnostics = collectDiagnostics('{% case -%}', { schema: sampleSchema });
    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
  });

  it('accepts valid case statements with an argument', () => {
    const diagnostics = collectDiagnostics('{% case user.role %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(false);
  });

  it('reports invalid default statements', () => {
    const diagnostics = collectDiagnostics('{% default invalid %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(true);
    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
  });

  it('accepts valid default statements without arguments', () => {
    const diagnostics = collectDiagnostics('{% default %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(false);
  });

  it('does not flag unknown statement keywords as invalid-statement syntax errors', () => {
    const diagnostics = collectDiagnostics('{% include partial %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidStatement')).toBe(false);
  });

  it('does not flag loop alias property paths as undefined in expressions', () => {
    const schema = {
      type: 'object',
      properties: {
        relationships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              target: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
      },
    };

    const text = '{% for relationship in relationships %}\n{{ relationship.type }}\n{% endfor %}';
    const diagnostics = collectDiagnostics(text, { schema: schema as object });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });

  it('does not flag loop alias property paths used inside statements', () => {
    const schema = {
      type: 'object',
      properties: {
        relationships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              target: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
      },
    };

    const text =
      '{% for relationship in relationships %}\n{% if relationship.note %}{{ relationship.note }}{% endif %}\n{% endfor %}';
    const diagnostics = collectDiagnostics(text, { schema: schema as object });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });

  it('flags invalid filters', () => {
    const diagnostics = collectDiagnostics('{{ user.name | unknown }}');
    expect(diagnostics[0]?.code).toBe('templjs.invalidFilter');
  });

  it('accepts built-in size and typeof filters', () => {
    const sizeDiagnostics = collectDiagnostics('{{ users | size }}');
    const typeofDiagnostics = collectDiagnostics('{{ user | typeof }}');

    expect(sizeDiagnostics.some((diag) => diag.code === 'templjs.invalidFilter')).toBe(false);
    expect(typeofDiagnostics.some((diag) => diag.code === 'templjs.invalidFilter')).toBe(false);
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

  it('anchors missing endfor range to for keyword with trim markers', () => {
    const diagnostics = collectDiagnostics('{%- for item in users -%}\n{{ item }}', {
      schema: sampleSchema,
    });

    const missingEndfor = diagnostics.find(
      (diag) => diag.code === 'templjs.unclosedStatement' && diag.message.includes('endfor')
    );
    expect(missingEndfor).toBeDefined();
    expect(missingEndfor?.range.start.line).toBe(0);
    expect(missingEndfor?.range.start.character).toBe(4);
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

  it('allows valid filters in statement expressions', () => {
    const diagnostics = collectDiagnostics('{% if notes | length > 0 %}', {
      schema: {
        type: 'object',
        properties: {
          notes: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.invalidFilter')).toBe(false);
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

  it('flags invalid alias property access for primitive array items', () => {
    const diagnostics = collectDiagnostics(
      '{% for condition in completionDefinition %}\n{{ condition.foo }}\n{% endfor %}',
      {
        schema: {
          type: 'object',
          properties: {
            completionDefinition: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      }
    );

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(true);
  });

  it('reports errors with suggestions for for-in variables', () => {
    const diagnostics = collectDiagnostics('{% for item in usr %}', {
      schema: sampleSchema,
    });
    expect(diagnostics[0]?.suggestion).toBeDefined();
  });

  it('highlights only the offending variable token in expression diagnostics', () => {
    const text = '- {{ unknownVar }}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });
    const diag = diagnostics.find((item) => item.code === 'templjs.undefinedVariable');

    expect(diag).toBeDefined();
    expect(diag?.range.start.line).toBe(0);
    expect(diag?.range.start.character).toBe(text.indexOf('unknownVar'));
    expect(diag?.range.end.character).toBe(text.indexOf('unknownVar') + 'unknownVar'.length);
  });

  it('highlights only the iterable path token in for-in diagnostics', () => {
    const text = '{% for item in unknowns %}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });
    const diag = diagnostics.find((item) => item.code === 'templjs.undefinedVariable');

    expect(diag).toBeDefined();
    expect(diag?.range.start.character).toBe(text.indexOf('unknowns'));
    expect(diag?.range.end.character).toBe(text.indexOf('unknowns') + 'unknowns'.length);
  });

  it('validates variable references inside full iterable expressions', () => {
    const text = '{% for user in users | reverse %}\n{{ user.id }}\n{% endfor %}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });

    expect(diagnostics.some((item) => item.code === 'templjs.undefinedVariable')).toBe(false);
  });

  it('validates all references in complex for-in iterable expressions', () => {
    const text = '{% for item in users + unknowns %}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });
    const undefinedVars = diagnostics.filter((item) => item.code === 'templjs.undefinedVariable');

    expect(undefinedVars).toHaveLength(1);
    expect(undefinedVars[0]?.range.start.character).toBe(text.indexOf('unknowns'));
    expect(undefinedVars[0]?.range.end.character).toBe(
      text.indexOf('unknowns') + 'unknowns'.length
    );
  });

  it('highlights statement filter ranges using parser offsets', () => {
    const text = '{% if unknownFilter | unknownFilter %}';
    const diagnostics = collectDiagnostics(text, {
      schema: sampleSchema,
    });
    const diag = diagnostics.find((item) => item.code === 'templjs.invalidFilter');

    expect(diag).toBeDefined();
    expect(diag?.range.start.character).toBe(text.lastIndexOf('unknownFilter'));
    expect(diag?.range.end.character).toBe(
      text.lastIndexOf('unknownFilter') + 'unknownFilter'.length
    );
  });

  it('highlights only the invalid filter token', () => {
    const text = '{{ user.name | unknownFilter }}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });
    const diag = diagnostics.find((item) => item.code === 'templjs.invalidFilter');

    expect(diag).toBeDefined();
    expect(diag?.range.start.character).toBe(text.indexOf('unknownFilter'));
    expect(diag?.range.end.character).toBe(text.indexOf('unknownFilter') + 'unknownFilter'.length);
  });

  it('reports distinct ranges for repeated invalid filters', () => {
    const text = '{{ user.name | unknownFilter | unknownFilter }}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });
    const filterDiagnostics = diagnostics.filter((item) => item.code === 'templjs.invalidFilter');

    expect(filterDiagnostics).toHaveLength(2);
    expect(filterDiagnostics[0]?.range.start.character).toBe(text.indexOf('unknownFilter'));
    expect(filterDiagnostics[1]?.range.start.character).toBe(text.lastIndexOf('unknownFilter'));
  });

  it('does not treat string literals as variables in ternary expressions', () => {
    const diagnostics = collectDiagnostics('{{ condition.length > 0 ? "x" : " " }}', {
      schema: {
        type: 'object',
        properties: {
          condition: { type: 'string' },
        },
      },
    });

    const undefinedVars = diagnostics.filter((diag) => diag.code === 'templjs.undefinedVariable');
    expect(undefinedVars).toHaveLength(0);
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

  it('accepts custom filters in diagnostics options', () => {
    const diagnostics = collectDiagnostics('{{ user.name | slugify }}', {
      customFilters: ['slugify'],
    });
    expect(diagnostics.length).toBe(0);
  });

  it('includes remapped base diagnostics when provided', () => {
    const diagnostics = collectDiagnostics('Hello {{ user.name }}', {
      baseDiagnostics: [
        {
          message: 'Base markdown error',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
          severity: DiagnosticSeverity.Warning,
        },
      ],
    });

    expect(diagnostics.some((diag) => diag.message === 'Base markdown error')).toBe(true);
  });

  it('uses frontmatter schema for frontmatter expressions and content schema for body expressions', () => {
    const text = '---\ntitle: "{{ front.title }}"\n---\n# Heading\n{{ content.heading }}';

    const diagnostics = collectDiagnostics(text, {
      schema: frontmatterSchema,
      contentSchema,
    });

    expect(diagnostics.length).toBe(0);
  });

  it('falls back to frontmatter schema when content schema is not configured', () => {
    const text = '---\ntitle: "{{ front.title }}"\n---\n# Heading\n{{ content.heading }}';

    const diagnostics = collectDiagnostics(text, {
      schema: frontmatterSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(true);
  });

  it('accepts .length access when the base path exists', () => {
    const diagnostics = collectDiagnostics('{% if users.length > 0 %}ok{% endif %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });

  it('flags .length access when the base path is invalid', () => {
    const diagnostics = collectDiagnostics('{% if unknown.length > 0 %}x{% endif %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(true);
  });

  it('ignores empty statement tags', () => {
    const diagnostics = collectDiagnostics('{%    %}\n{{ user.name }}', {
      schema: sampleSchema,
    });

    expect(diagnostics).toHaveLength(0);
  });

  it('does not treat unknown statement tags as unclosed blocks', () => {
    const diagnostics = collectDiagnostics('{% custom user.name %}\n{{ user.name }}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.unclosedStatement')).toBe(false);
    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });

  it('does not report filter names as variables in for iterable expressions', () => {
    const diagnostics = collectDiagnostics('{% for user in users | unknownFilter %}x{% endfor %}', {
      schema: sampleSchema,
    });

    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });

  it('uses host-language semantic zoning when frontmatter range is not provided', () => {
    const text = '---\ntitle: "{{ front.title }}"\n---\n{{ content.heading }}';
    const diagnostics = collectDiagnostics(text, {
      schema: frontmatterSchema,
      contentSchema,
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(diagnostics).toHaveLength(0);
  });

  it('resolves scoped aliases directly from raw template text', () => {
    const text = '{% for relationship in relationships %}\n{{ relationship.target }}\n{% endfor %}';
    const offset = text.indexOf('relationship.target');
    const resolved = resolveScopedPathInText(text, 'relationship.target', offset);

    expect(resolved).toBe('relationships[0].target');
  });

  it('returns an empty array when remapping no base diagnostics', () => {
    expect(remapDiagnosticsToOriginal('Hello {{ name }}', [])).toEqual([]);
  });

  // ── Draft 2020-12 schema compatibility ────────────────────────────────────
  // Regression: SchemaValidator used plain Ajv (draft-07) which threw on
  // "no schema with key or ref https://json-schema.org/draft/2020-12/schema".
  // These tests ensure the server never crashes with real-world schemas.

  it('does not throw when schema declares $schema: draft 2020-12 with unevaluatedProperties', () => {
    const draft2020Schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: '/test/milestone',
      type: 'object',
      unevaluatedProperties: false,
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
      },
    };

    expect(() =>
      collectDiagnostics('{{ title }}', { schema: draft2020Schema as object })
    ).not.toThrow();
  });

  it('returns empty diagnostics (not an error) when schema has an unresolvable remote $ref', () => {
    const schemaWithRemoteRef = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: '/test/remote-ref',
      type: 'object',
      allOf: [{ $ref: 'https://does-not-exist.example.com/schemas/base.json#/$defs/core' }],
      properties: {
        title: { type: 'string' },
      },
    };

    expect(() =>
      collectDiagnostics('{{ title }}', { schema: schemaWithRemoteRef as object })
    ).not.toThrow();
  });

  it('does not throw when draft 2020-12 content schema has unevaluatedProperties', () => {
    const draft2020Content = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      unevaluatedProperties: false,
      properties: {
        narrative: { type: 'string' },
        objectives: { type: 'array', items: { type: 'string' } },
      },
    };
    const text = '---\ntype: project\n---\n{{ narrative }}';

    expect(() =>
      collectDiagnostics(text, { schema: sampleSchema, contentSchema: draft2020Content as object })
    ).not.toThrow();
  });
  it('flags loop alias property accesses when array items are not enumerated in schema', () => {
    // Real-world case: schema defines the array but omits items.properties
    const schema = {
      type: 'object',
      properties: {
        relationships: { type: 'array' },
      },
    };

    const text =
      '{% for relationship in relationships %}\n{{ relationship.type }}\n{{ relationship.target }}\n{% if relationship.note %}{{ relationship.note }}{% endif %}\n{% endfor %}';
    const diagnostics = collectDiagnostics(text, { schema: schema as object });

    expect(
      diagnostics.filter((d) => d.code === 'templjs.undefinedVariable').length
    ).toBeGreaterThan(0);
  });
  it('validates for-in variables when alias name matches iterable root', () => {
    // `for users in users` — alias and iterable share the same name; the iterable
    // start offset must be derived deterministically, not with indexOf.
    const diagnostics = collectDiagnostics('{% for users in users %}', {
      schema: sampleSchema,
    });
    // `users` is defined in the schema so no undefinedVariable diagnostic expected
    expect(diagnostics.some((diag) => diag.code === 'templjs.undefinedVariable')).toBe(false);
  });

  describe('regression: complex iterable expressions (WI-062 drift prevention)', () => {
    it('does not truncate computed bracket expressions like users[activeIndex + 1]', () => {
      const schema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: { type: 'object', properties: { name: { type: 'string' } } },
          },
          activeIndex: { type: 'number' },
        },
      };
      const text = '{% for user in users[activeIndex + 1] %}{{ user.name }}{% endfor %}';

      const diagnostics = collectDiagnostics(text, { schema: schema as object });
      // Should not flag `activeIndex + 1` as undefined; the iterable should be parsed fully
      const truncationIssues = diagnostics.filter(
        (d) => d.code === 'templjs.undefinedVariable' && d.message.includes('activeIndex')
      );
      expect(truncationIssues.length).toBe(0);
    });

    it('derives correct iterableStart offset for for-in headers regardless of spacing', () => {
      const schema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      };
      // Multiple whitespace variants should all correctly identify iterableStart
      const variants = [
        '{% for item in items %}{{ item.id }}{% endfor %}',
        '{%  for  item  in  items  %}{{ item.id }}{% endfor %}',
        '{% for item   in   items %}{{ item.id }}{% endfor %}',
      ];

      variants.forEach((text) => {
        const diagnostics = collectDiagnostics(text, { schema: schema as object });
        // No offset-misalignment errors on the loop alias
        const aliasErrors = diagnostics.filter(
          (d) => d.code === 'templjs.undefinedVariable' && d.message.includes('item')
        );
        expect(aliasErrors.length).toBe(0);
      });
    });

    it('preserves alias scope across nested loops using outer-loop aliases in inner iterable', () => {
      const schema = {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                members: {
                  type: 'array',
                  items: { type: 'object', properties: { id: { type: 'string' } } },
                },
              },
            },
          },
        },
      };
      const text =
        '{% for group in groups %}{% for member in group.members %}{{ member.id }}{% endfor %}{% endfor %}';

      const diagnostics = collectDiagnostics(text, { schema: schema as object });
      // Should not flag `group` as undefined when used in inner loop
      const undefinedGroup = diagnostics.filter(
        (d) => d.code === 'templjs.undefinedVariable' && d.message.includes('group')
      );
      expect(undefinedGroup.length).toBe(0);
    });

    it('handles multiline for-in headers without offset shift', () => {
      const schema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: { type: 'object', properties: { name: { type: 'string' } } },
          },
        },
      };
      const text = '{% for\nuser\nin\nusers %}{{ user.name }}{% endfor %}';

      const diagnostics = collectDiagnostics(text, { schema: schema as object });
      // Multiline headers should not cause offset misalignment diagnostics
      const offsetErrors = diagnostics.filter(
        (d) => d.code === 'templjs.undefinedVariable' && d.message.includes('user')
      );
      expect(offsetErrors.length).toBe(0);
    });
  });
});
