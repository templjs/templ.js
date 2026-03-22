import { describe, it, expect, vi } from 'vitest';
import type { IntellisenseProvider } from '../src/index.js';
import { TempljsServicePlugin } from '../src/service-plugin.js';

const sampleSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          target: { type: 'string' },
        },
      },
    },
  },
};

const frontmatterSchema = {
  type: 'object',
  properties: {
    frontData: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    },
  },
};

const bodySchema = {
  type: 'object',
  properties: {
    contentData: {
      type: 'object',
      properties: {
        heading: { type: 'string' },
      },
    },
  },
};

describe('TempljsServicePlugin', () => {
  describe('getCompletions', () => {
    it('returns LSP-ready completion items with numeric kind', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ user. }}';
      const offset = text.indexOf('. }') + 1; // After the dot

      const completions = plugin.getCompletions(text, offset, {
        schema: sampleSchema,
      });

      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);

      // Check LSP format
      const item = completions[0];
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('kind');
      expect(typeof item.kind).toBe('number');
    });

    it('handles empty schema gracefully', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ foo. }}';
      const offset = text.indexOf('. }') + 1;

      const completions = plugin.getCompletions(text, offset, {});

      expect(Array.isArray(completions)).toBe(true);
    });

    it('supports injecting an intellisense provider', () => {
      const stubProvider = {
        getCompletions: vi.fn().mockReturnValue([
          {
            label: 'stubbed',
            kind: 'property',
          },
        ]),
        getHover: vi.fn().mockReturnValue(null),
        getDefinition: vi.fn().mockReturnValue(null),
      } as unknown as IntellisenseProvider;
      const plugin = new TempljsServicePlugin(stubProvider);

      const completions = plugin.getCompletions('{{ anything }}', 5, {
        schema: sampleSchema,
      });

      expect(stubProvider.getCompletions).toHaveBeenCalled();
      expect(completions).toEqual([
        {
          label: 'stubbed',
          detail: undefined,
          documentation: undefined,
          kind: 10,
        },
      ]);
    });

    it('provides completions in statement context', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{% if user. %}ok{% endif %}';
      const offset = text.indexOf('user.') + 'user.'.length;

      const completions = plugin.getCompletions(text, offset, {
        schema: sampleSchema,
      });

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.some((c) => c.label === 'name')).toBe(true);
    });

    it('handles for-loop alias scope', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{% for relationship in relationships %}\n{{ relationship. }}\n{% endfor %}';
      const offset = text.indexOf('relationship.') + 'relationship.'.length;

      const completions = plugin.getCompletions(text, offset, {
        schema: sampleSchema,
      });

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.some((c) => c.label === 'type' || c.label === 'target')).toBe(true);
    });

    it('maps all completion kinds to LSP numeric kinds', () => {
      const stubProvider = {
        getCompletions: vi.fn().mockReturnValue([
          { label: 'prop', kind: 'property' },
          { label: 'var', kind: 'variable' },
          { label: 'flt', kind: 'filter' },
          { label: 'kw', kind: 'keyword' },
        ]),
        getHover: vi.fn().mockReturnValue(null),
        getDefinition: vi.fn().mockReturnValue(null),
      } as unknown as IntellisenseProvider;
      const plugin = new TempljsServicePlugin(stubProvider);

      const completions = plugin.getCompletions('{{ anything }}', 5, { schema: sampleSchema });

      expect(completions).toEqual([
        expect.objectContaining({ label: 'prop', kind: 10 }),
        expect.objectContaining({ label: 'var', kind: 6 }),
        expect.objectContaining({ label: 'flt', kind: 3 }),
        expect.objectContaining({ label: 'kw', kind: 14 }),
      ]);
    });
  });

  describe('getHover', () => {
    it('returns LSP-ready hover info', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ user.name }}';
      const offset = text.indexOf('user');

      const hover = plugin.getHover(text, offset, {
        schema: sampleSchema,
      });

      if (hover) {
        expect(hover).toHaveProperty('contents');
        expect(hover.contents).toHaveProperty('kind');
        expect(hover.contents).toHaveProperty('value');
        expect(typeof hover.contents.value).toBe('string');
      }
    });

    it('returns null when not in expression', () => {
      const plugin = new TempljsServicePlugin();
      const text = 'plain text here';
      const offset = 5;

      const hover = plugin.getHover(text, offset, {
        schema: sampleSchema,
      });

      expect(hover).toBeNull();
    });
  });

  describe('getDefinition', () => {
    it('returns LSP-ready definition location', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ user.name }}';
      const offset = text.indexOf('user');

      const definition = plugin.getDefinition(text, offset, {
        schema: sampleSchema,
        schemaUri: 'file:///schema.json',
      });

      if (definition) {
        expect(definition).toHaveProperty('uri');
        expect(definition).toHaveProperty('range');
        expect(definition.uri).toBe('file:///schema.json');
        expect(definition.range).toHaveProperty('start');
        expect(definition.range).toHaveProperty('end');
      }
    });

    it('returns null without schemaUri', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ user.name }}';
      const offset = text.indexOf('user');

      const definition = plugin.getDefinition(text, offset, {
        schema: sampleSchema,
      });

      expect(definition).toBeNull();
    });

    it('returns a fallback range when provider definition has no range', () => {
      const stubProvider = {
        getCompletions: vi.fn().mockReturnValue([]),
        getHover: vi.fn().mockReturnValue(null),
        getDefinition: vi.fn().mockReturnValue({
          uri: 'file:///schema.json',
          range: undefined,
        }),
      } as unknown as IntellisenseProvider;
      const plugin = new TempljsServicePlugin(stubProvider);

      const definition = plugin.getDefinition('{{ user.name }}', 4, {
        schema: sampleSchema,
        schemaUri: 'file:///schema.json',
      });

      expect(definition).not.toBeNull();
      expect(definition?.uri).toBe('file:///schema.json');
      expect(definition?.range).toEqual({
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      });
    });

    it('returns a concrete definition range when available', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ user.name }}';
      const offset = text.indexOf('user');

      const definition = plugin.getDefinition(text, offset, {
        schema: sampleSchema,
        schemaUri: 'file:///schema.json',
      });

      if (definition) {
        expect(definition.range.start.line).toBeGreaterThanOrEqual(0);
        expect(definition.range.start.character).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles for-loop alias scope in definition', () => {
      const plugin = new TempljsServicePlugin();
      const text =
        '{% for relationship in relationships %}\n{{ relationship.target }}\n{% endfor %}';
      const offset = text.indexOf('relationship.target');

      const definition = plugin.getDefinition(text, offset, {
        schema: sampleSchema,
        schemaUri: 'file:///schema.json',
      });

      expect(definition).not.toBeNull();
    });

    it('routes frontmatter and body definitions to the correct schema URI', () => {
      const plugin = new TempljsServicePlugin();
      const text = ['---', 'frontData:', '  title: hello', '---', '{{ contentData.heading }}'].join(
        '\n'
      );

      const frontmatterOffset = text.indexOf('title:') + 1;
      const contentOffset = text.indexOf('contentData') + 2;

      const frontmatterDefinition = plugin.getDefinition(text, frontmatterOffset, {
        schema: frontmatterSchema,
        schemaUri: 'file:///frontmatter-schema.json',
        contentSchema: bodySchema,
        contentSchemaUri: 'file:///content-schema.json',
      });

      const contentDefinition = plugin.getDefinition(text, contentOffset, {
        schema: frontmatterSchema,
        schemaUri: 'file:///frontmatter-schema.json',
        contentSchema: bodySchema,
        contentSchemaUri: 'file:///content-schema.json',
      });

      expect(frontmatterDefinition).not.toBeNull();
      expect(contentDefinition).not.toBeNull();
      expect(frontmatterDefinition?.uri).toBe('file:///frontmatter-schema.json');
      expect(contentDefinition?.uri).toBe('file:///content-schema.json');
    });

    it('resolves canonical nested statement alias definitions', () => {
      const plugin = new TempljsServicePlugin();
      const text = [
        '{% for relationship in relationships %}',
        '  {% if relationship.target %}ok{% endif %}',
        '{% endfor %}',
      ].join('\n');
      const offset = text.indexOf('relationship.target') + 2;

      const definition = plugin.getDefinition(text, offset, {
        schema: sampleSchema,
        schemaUri: 'file:///schema.json',
      });

      expect(definition).not.toBeNull();
    });
  });

  describe('collectDiagnostics', () => {
    it('returns LSP-ready diagnostic items', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ unknownVar }}';

      const diagnostics = plugin.collectDiagnostics(text, {
        schema: sampleSchema,
      });

      expect(Array.isArray(diagnostics)).toBe(true);

      if (diagnostics.length > 0) {
        const diag = diagnostics[0];
        expect(diag).toHaveProperty('message');
        expect(diag).toHaveProperty('severity');
        expect(diag).toHaveProperty('range');
        expect(diag).toHaveProperty('code');
        expect(typeof diag.severity).toBe('number');
      }
    });

    it('detects undefined variables', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ notInSchema }}';

      const diagnostics = plugin.collectDiagnostics(text, {
        schema: sampleSchema,
      });

      expect(diagnostics.some((d) => d.code === 'templjs.undefinedVariable')).toBe(true);
    });

    it('accepts undefined variables in valid scope', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{% for rel in relationships %}{{ rel.type }}{% endfor %}';

      const diagnostics = plugin.collectDiagnostics(text, {
        schema: sampleSchema,
      });

      expect(diagnostics.some((d) => d.code === 'templjs.undefinedVariable')).toBe(false);
    });

    it('detects invalid filters', () => {
      const plugin = new TempljsServicePlugin();
      const text = '{{ user.name | unknownFilter }}';

      const diagnostics = plugin.collectDiagnostics(text, {
        schema: sampleSchema,
      });

      expect(diagnostics.some((d) => d.code === 'templjs.invalidFilter')).toBe(true);
    });

    it('preserves diagnostic source when provided and defaults when omitted', () => {
      const diagnostics = new TempljsServicePlugin().collectDiagnostics('{{ unknownVar }}', {
        schema: sampleSchema,
      });

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.every((d) => typeof d.source === 'string' && d.source.length > 0)).toBe(
        true
      );
    });
  });
});
