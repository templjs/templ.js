import { describe, expect, it } from 'vitest';
import {
  collectDiagnostics,
  DiagnosticSeverity,
  remapDiagnosticsToOriginal,
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

  it('highlights only the invalid filter token', () => {
    const text = '{{ user.name | unknownFilter }}';
    const diagnostics = collectDiagnostics(text, { schema: sampleSchema });
    const diag = diagnostics.find((item) => item.code === 'templjs.invalidFilter');

    expect(diag).toBeDefined();
    expect(diag?.range.start.character).toBe(text.indexOf('unknownFilter'));
    expect(diag?.range.end.character).toBe(text.indexOf('unknownFilter') + 'unknownFilter'.length);
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
});
