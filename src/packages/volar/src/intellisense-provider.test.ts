import { describe, expect, it } from 'vitest';
import { IntellisenseProvider } from './intellisense-provider';

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

describe('IntellisenseProvider', () => {
  const provider = new IntellisenseProvider();

  it('provides top-level variable completions', () => {
    const items = provider.getCompletions('{{ us', 4, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'user')).toBe(true);
  });

  it('provides property completions after dot', () => {
    const items = provider.getCompletions('{{ user. }}', 9, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'name')).toBe(true);
  });

  it('provides filter completions after pipe', () => {
    const items = provider.getCompletions('{{ user.name | }}', 16, {
      schema: sampleSchema,
    });
    expect(items.some((item) => item.kind === 'filter')).toBe(true);
  });

  it('provides keyword completions in statements', () => {
    const items = provider.getCompletions('{% i %}', 4, { schema: sampleSchema });
    expect(items.some((item) => item.kind === 'keyword')).toBe(true);
  });

  it('returns empty completions outside templates', () => {
    const items = provider.getCompletions('plain text', 5, { schema: sampleSchema });
    expect(items.length).toBe(0);
  });

  it('supports custom filters', () => {
    const items = provider.getCompletions('{{ user.name | }}', 16, {
      schema: sampleSchema,
      customFilters: [
        {
          name: 'custom',
          description: 'Custom filter',
          returnType: 'string',
          parameters: [],
        },
      ],
    });
    expect(items.some((item) => item.label === 'custom')).toBe(true);
  });

  it('supports custom keywords', () => {
    const items = provider.getCompletions('{% cu %}', 5, {
      customKeywords: ['custom'],
    });
    expect(items.some((item) => item.label === 'custom')).toBe(true);
  });

  it('returns hover info for variables', () => {
    const hover = provider.getHover('{{ user.name }}', 5, { schema: sampleSchema });
    expect(hover?.contents).toContain('user');
  });

  it('returns hover info for filters', () => {
    const hover = provider.getHover('{{ user.name | upper }}', 20, {
      schema: sampleSchema,
    });
    expect(hover?.contents).toContain('upper');
  });

  it('returns null hover outside expressions', () => {
    const hover = provider.getHover('plain text', 5, { schema: sampleSchema });
    expect(hover).toBeNull();
  });

  it('returns definition when schema uri provided', () => {
    const def = provider.getDefinition('{{ user.name }}', 5, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });
    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('user.name');
  });

  it('returns null definition without schema uri', () => {
    const def = provider.getDefinition('{{ user.name }}', 5, { schema: sampleSchema });
    expect(def).toBeNull();
  });

  it('returns signature help for filter call', () => {
    const help = provider.getSignatureHelp('{{ user.name | replace("a", "b") }}', 28, {
      schema: sampleSchema,
    });
    expect(help?.name).toBe('replace');
  });

  it('returns null signature help when no filter call', () => {
    const help = provider.getSignatureHelp('{{ user.name }}', 10, { schema: sampleSchema });
    expect(help).toBeNull();
  });

  it('supports custom delimiters for expressions', () => {
    const items = provider.getCompletions('<: us :>', 3, {
      schema: sampleSchema,
      delimiters: {
        expressionStart: '<:',
        expressionEnd: ':>',
      },
    });
    expect(items.some((item) => item.label === 'user')).toBe(true);
  });

  it('supports custom delimiters for statements', () => {
    const items = provider.getCompletions('<< if >>', 3, {
      delimiters: {
        statementStart: '<<',
        statementEnd: '>>',
      },
    });
    expect(items.some((item) => item.kind === 'keyword')).toBe(true);
  });

  it('returns empty completions when schema missing', () => {
    const items = provider.getCompletions('{{ user }}', 5);
    expect(items.length).toBe(0);
  });

  it('returns property completions for nested path', () => {
    const items = provider.getCompletions('{{ user. }}', 9, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'email')).toBe(true);
  });

  it('returns filter completions when cursor after pipe', () => {
    const items = provider.getCompletions('{{ user.name | up }}', 19, {
      schema: sampleSchema,
    });
    expect(items.some((item) => item.label === 'upper')).toBe(true);
  });

  it('returns hover info for nested variable path', () => {
    const hover = provider.getHover('{{ user.email }}', 5, { schema: sampleSchema });
    expect(hover?.contents).toContain('user.email');
  });

  it('returns null hover when variable not in schema', () => {
    const hover = provider.getHover('{{ unknown }}', 5, { schema: sampleSchema });
    expect(hover).toBeNull();
  });

  it('returns signature help for custom filters', () => {
    const help = provider.getSignatureHelp('{{ user.name | custom() }}', 22, {
      customFilters: [
        {
          name: 'custom',
          description: 'Custom filter',
          returnType: 'string',
          parameters: [{ name: 'value', type: 'string' }],
        },
      ],
    });
    expect(help?.name).toBe('custom');
  });
});
