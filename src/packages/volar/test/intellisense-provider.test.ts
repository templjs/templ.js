import { describe, expect, it } from 'vitest';
import { IntellisenseProvider, type SemanticReadAdapter } from '../src/intellisense-provider.js';

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

const nestedScopeSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Outer item name' },
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Inner child name' },
              },
            },
          },
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

  it('returns adapter-backed alias hover', () => {
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('{{ item }}') + 4;

    const mockAdapter: SemanticReadAdapter = {
      resolveScopedPath: (_text, basePath) => basePath,
      getChildCompletions: () => [],
      getEnumValueCompletions: () => [],
      getPathDetails: () => null,
      resolvePathDefinition: () => null,
      resolveDocumentDefinition: () => null,
      resolveLocalAliasDefinition: () => ({
        start: text.indexOf('item in'),
        end: text.indexOf('item in') + 'item'.length,
      }),
    };

    const providerWithFallback = new IntellisenseProvider(mockAdapter);
    const hover = providerWithFallback.getHover(text, offset, { schema: sampleSchema });

    expect(hover?.contents).toBe('item: local template variable');
  });

  it('returns adapter-backed alias definition', () => {
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('{{ item }}') + 4;
    const declarationStartOffset = text.indexOf('item in');

    const mockAdapter: SemanticReadAdapter = {
      resolveScopedPath: (_text, basePath) => basePath,
      getChildCompletions: () => [],
      getEnumValueCompletions: () => [],
      getPathDetails: () => null,
      resolvePathDefinition: () => null,
      resolveDocumentDefinition: () => null,
      resolveLocalAliasDefinition: () => ({
        start: declarationStartOffset,
        end: declarationStartOffset + 'item'.length,
      }),
    };

    const providerWithFallback = new IntellisenseProvider(mockAdapter);
    const definition = providerWithFallback.getDefinition(text, offset, {
      schema: sampleSchema,
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(definition?.uri).toBe('file:///workspace/project.md.tpl');
    expect(definition?.range).toEqual({
      start: { line: 0, character: declarationStartOffset },
      end: { line: 0, character: declarationStartOffset + 'item'.length },
    });
  });

  it('includes in-scope aliases in symbol completions', () => {
    const text = '{% for item in users %}{{ it }}{% endfor %}';
    const offset = text.indexOf('it }}') + 2;

    const items = provider.getCompletions(text, offset, { schema: sampleSchema });

    expect(items.some((item) => item.label === 'item' && item.kind === 'variable')).toBe(true);
  });

  it('allows injecting a semantic read adapter for isolation', () => {
    const mockAdapter: SemanticReadAdapter = {
      resolveScopedPath: (_text, basePath) => basePath,
      getChildCompletions: () => [
        {
          label: 'injected',
          kind: 'variable',
        },
      ],
      getEnumValueCompletions: () => [],
      getPathDetails: () => null,
      resolvePathDefinition: () => null,
      resolveDocumentDefinition: () => null,
      resolveLocalAliasDefinition: () => null,
    };

    const isolatedProvider = new IntellisenseProvider(mockAdapter);
    const items = isolatedProvider.getCompletions('{{ inj }}', 7, { schema: sampleSchema });

    expect(items.map((item) => item.label)).toEqual(['injected']);
  });

  it('provides property completions after dot', () => {
    const items = provider.getCompletions('{{ user. }}', 9, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'name')).toBe(true);
  });

  it('provides inferred property completions for set object literals without schema paths', () => {
    const text = '{% set profile = { name: "Ada", meta: { city: "London" } } %}{{ profile. }}';
    const offset = text.lastIndexOf('profile.') + 'profile.'.length;

    const items = provider.getCompletions(text, offset, {
      schema: {
        type: 'object',
        properties: {},
      },
    });

    expect(items.some((item) => item.label === 'name' && item.kind === 'property')).toBe(true);
    expect(items.some((item) => item.label === 'meta' && item.kind === 'property')).toBe(true);
  });

  it('provides filter completions after pipe', () => {
    const items = provider.getCompletions('{{ user.name | }}', 16, {
      schema: sampleSchema,
    });
    expect(items.some((item) => item.kind === 'filter')).toBe(true);
  });

  it('returns filter completions from filter signatures', () => {
    const text = '{{ user.name | no }}';
    const offset = text.indexOf('no') + 2;

    const items = provider.getCompletions(text, offset, {
      schema: sampleSchema,
      customFilters: [
        {
          name: 'known',
          description: 'Known filter only',
          returnType: 'string',
          parameters: [],
        },
      ],
    });

    const known = items.find((item) => item.label === 'known');
    expect(known?.kind).toBe('filter');
    expect(known?.detail).toBe('string');
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

  it('prefers custom filters over built-ins with the same name', () => {
    const items = provider.getCompletions('{{ user.name | up }}', 17, {
      schema: sampleSchema,
      customFilters: [
        {
          name: 'upper',
          description: 'Custom upper override',
          returnType: 'string',
          parameters: [{ name: 'locale', type: 'string', description: 'Locale tag' }],
        },
      ],
    });

    expect(items.filter((item) => item.label === 'upper')).toHaveLength(1);
    const upper = items.find((item) => item.label === 'upper');
    expect(upper?.detail).toBe('string');
    expect(upper?.documentation).toContain('Custom upper override');
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

  it('returns alias hover when adapter can resolve local alias declaration', () => {
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('{{ item }}') + 4;

    const hover = provider.getHover(text, offset, { schema: sampleSchema });

    expect(hover?.contents).toBe('item: local template variable');
  });

  it('returns hover info for filters', () => {
    const text = '{{ user.name | upper }}';
    const hover = provider.getHover(text, text.indexOf('upper') + 2, {
      schema: sampleSchema,
    });
    expect(hover?.contents).toContain('upper');
  });

  it('resolves statement hover to variable path when cursor is on source before a filter', () => {
    const text = '{% if items | length > 0 %}ok{% endif %}';
    const offset = text.indexOf('items') + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object' },
            description: 'Collection of items',
          },
        },
      },
      documentUri: 'file:///workspace/example.yaml.tmpl',
    });

    expect(hover?.contents).toContain('items: array');
    expect(hover?.contents).toContain('Collection of items');
  });

  it('returns segment-scoped hover ranges for member access paths', () => {
    const text = '{{ user.name }}';
    const userHover = provider.getHover(text, text.indexOf('user') + 1, {
      schema: sampleSchema,
      documentUri: 'file:///workspace/example.yaml.tmpl',
    });
    const nameHover = provider.getHover(text, text.indexOf('name') + 1, {
      schema: sampleSchema,
      documentUri: 'file:///workspace/example.yaml.tmpl',
    });

    expect(userHover?.range).toEqual({
      start: { line: 0, character: 3 },
      end: { line: 0, character: 7 },
    });
    expect(nameHover?.range).toEqual({
      start: { line: 0, character: 8 },
      end: { line: 0, character: 12 },
    });
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

  it('returns local alias definition when adapter can resolve local alias declaration', () => {
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('{{ item }}') + 4;
    const declarationStartOffset = text.indexOf('item in');

    const definition = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(definition?.uri).toBe('file:///workspace/project.md.tpl');
    expect(definition?.range).toEqual({
      start: { line: 0, character: declarationStartOffset },
      end: { line: 0, character: declarationStartOffset + 'item'.length },
    });
  });

  it('returns null definition without schema uri', () => {
    const def = provider.getDefinition('{{ user.name }}', 5, { schema: sampleSchema });
    expect(def).toBeNull();
  });

  it('returns local inferred member definition for set object literals', () => {
    const text =
      '{% set profile = { name: "Ada", meta: { city: "London" } } %}{{ profile.meta.city }}';
    const offset = text.indexOf('profile.meta.city') + 'profile.meta.city'.length - 1;

    const definition = provider.getDefinition(text, offset, {
      documentUri: 'file:///workspace/project.md.tpl',
      schema: {
        type: 'object',
        properties: {
          profile: {
            type: 'object',
            properties: {
              meta: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                },
              },
            },
          },
        },
      },
    });

    expect(definition?.uri).toBe('file:///workspace/project.md.tpl');
    expect(definition?.range).toBeDefined();
    const key = text.slice(definition!.range!.start.character, definition!.range!.end.character);
    expect(key).toBe('city');
  });

  it('returns inferred local definition for statement expression variables', () => {
    const text =
      '{% set profile = { meta: { city: "London" } } %}{% if profile.meta.city %}{% endif %}';
    const offset = text.indexOf('profile.meta.city') + 'profile.meta.city'.length - 1;

    const definition = provider.getDefinition(text, offset, {
      documentUri: 'file:///workspace/project.md.tpl',
      schema: sampleSchema,
    });

    expect(definition?.uri).toBe('file:///workspace/project.md.tpl');
    expect(definition?.range).toBeDefined();
    const key = text.slice(definition!.range!.start.character, definition!.range!.end.character);
    expect(key).toBe('city');
  });

  it('returns inferred local definition for for-iterable statement variables', () => {
    const text =
      '{% set profile = { users: [{ id: 1 }] } %}{% for item in profile.users %}{{ item.id }}{% endfor %}';
    const offset = text.indexOf('profile.users') + 'profile.users'.length - 1;

    const definition = provider.getDefinition(text, offset, {
      documentUri: 'file:///workspace/project.md.tpl',
      schema: sampleSchema,
    });

    expect(definition?.uri).toBe('file:///workspace/project.md.tpl');
    expect(definition?.range).toBeDefined();
    const key = text.slice(definition!.range!.start.character, definition!.range!.end.character);
    expect(key).toBe('users');
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

  it('provides filter completions with custom delimiters', () => {
    const text = '<% if user.name | up %>';
    const offset = text.indexOf('up') + 'up'.length;

    const items = provider.getCompletions(text, offset, {
      schema: sampleSchema,
      delimiters: {
        statementStart: '<%',
        statementEnd: '%>',
        expressionStart: '<:',
        expressionEnd: ':>',
      },
    });

    expect(items.some((item) => item.label === 'upper')).toBe(true);
  });

  it('provides filter completions in statement expressions', () => {
    const text = '{% if notes | ca == "array" %}';
    const offset = text.indexOf('ca') + 'ca'.length;
    const items = provider.getCompletions(text, offset, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'capitalize')).toBe(true);
  });

  it('resolves for-loop alias to schema properties in expressions', () => {
    const text = '{% for item in users %}{{ item. }}{% endfor %}';
    // cursor after the dot in `item.`
    const offset = text.indexOf('item.') + 'item.'.length;
    const items = provider.getCompletions(text, offset, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'id')).toBe(true);
  });

  it('resolves for-loop alias to schema properties in statement expressions', () => {
    const text = '{% for item in users %}{% if item. %}{% endif %}{% endfor %}';
    const offset = text.indexOf('item.') + 'item.'.length;
    const items = provider.getCompletions(text, offset, { schema: sampleSchema });
    expect(items.some((item) => item.label === 'id')).toBe(true);
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

  it('includes size and typeof in built-in filter completions', () => {
    const items = provider.getCompletions('{{ user.name |  }}', 16, {
      schema: sampleSchema,
    });
    expect(items.some((item) => item.label === 'size')).toBe(true);
    expect(items.some((item) => item.label === 'typeof')).toBe(true);
  });

  it('filters top-level variable completions by prefix', () => {
    const items = provider.getCompletions('{{ us }}', 5, { schema: sampleSchema });
    expect(items.map((item) => item.label)).toEqual(['user', 'users']);
  });

  it('normalizes array-index prefix to match top-level completions', () => {
    const items = provider.getCompletions('{{ users[ }}', 9, { schema: sampleSchema });
    expect(items.map((item) => item.label)).toEqual(['users']);
  });

  it('filters property completions by prefix after dot', () => {
    const items = provider.getCompletions('{{ user.n }}', 10, { schema: sampleSchema });
    expect(items.map((item) => item.label)).toEqual(['name']);
  });

  it('filters filter completions by typed prefix', () => {
    const items = provider.getCompletions('{{ user.name | lo }}', 19, {
      schema: sampleSchema,
    });
    expect(items[0]?.label).toBe('lower');
  });

  it('sorts keyword completions by relevance and label', () => {
    const items = provider.getCompletions('{% e %}', 5, {});
    expect(items.slice(0, 3).map((item) => item.label)).toEqual(['elif', 'else', 'endblock']);
  });

  it('returns hover info for nested variable path', () => {
    const hover = provider.getHover('{{ user.email }}', 5, { schema: sampleSchema });
    expect(hover?.contents).toContain('user.email');
  });

  it('returns null hover when variable not in schema', () => {
    const hover = provider.getHover('{{ unknown }}', 5, { schema: sampleSchema });
    expect(hover).toBeNull();
  });

  it('returns hover info for top-level variable', () => {
    const hover = provider.getHover('{{ user }}', 5, { schema: sampleSchema });
    expect(hover?.contents).toContain('user');
  });

  it('returns hover info for custom filter', () => {
    const text = '{{ user.name | custom }}';
    const hover = provider.getHover(text, text.indexOf('custom') + 2, {
      customFilters: [
        {
          name: 'custom',
          description: 'Custom hover docs',
          returnType: 'string',
          parameters: [],
        },
      ],
    });
    expect(hover?.contents).toContain('Custom hover docs');
  });

  it('returns null hover for unknown filter name', () => {
    const hover = provider.getHover('{{ user.name | unknownfilter }}', 27, {
      schema: sampleSchema,
    });
    expect(hover).toBeNull();
  });

  it('supports hover with custom expression delimiters', () => {
    const hover = provider.getHover('<: user.name :>', 5, {
      schema: sampleSchema,
      delimiters: {
        expressionStart: '<:',
        expressionEnd: ':>',
      },
    });
    expect(hover?.contents).toContain('user.name');
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

  it('returns definition path for array-style variable expression', () => {
    const def = provider.getDefinition('{{ users[0].id }}', 5, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });
    expect(def?.path).toBe('users[0].id');
  });

  it('supports definition with custom expression delimiters', () => {
    const def = provider.getDefinition('<: user.email :>', 5, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
      delimiters: {
        expressionStart: '<:',
        expressionEnd: ':>',
      },
    });
    expect(def?.path).toBe('user.email');
  });

  it('returns null definition when expression does not start with a variable', () => {
    const def = provider.getDefinition('{{ | upper }}', 5, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });
    expect(def).toBeNull();
  });

  it('returns definition from statement expression context', () => {
    const text = '{% if user.email %}ok{% endif %}';
    const offset = text.indexOf('user.email') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('user.email');
  });

  it('uses frontmatter schema completions in frontmatter zone', () => {
    const text = '---\ntitle: "{{ frontD }}"\n---\n{{ contentD }}';
    const offset = text.indexOf('frontD') + 'frontD'.length;

    const items = provider.getCompletions(text, offset, {
      schema: frontmatterSchema,
      contentSchema: bodySchema,
    });

    expect(items.some((item) => item.label === 'frontData')).toBe(true);
    expect(items.some((item) => item.label === 'contentData')).toBe(false);
  });

  it('uses content schema completions in markdown body zone', () => {
    const text = '---\ntitle: "{{ frontData.title }}"\n---\n{{ contentD }}';
    const offset = text.indexOf('contentD') + 'contentD'.length;

    const items = provider.getCompletions(text, offset, {
      schema: frontmatterSchema,
      contentSchema: bodySchema,
    });

    expect(items.some((item) => item.label === 'contentData')).toBe(true);
    expect(items.some((item) => item.label === 'frontData')).toBe(false);
  });

  it('uses content schema URI for definitions in markdown body', () => {
    const text = '---\ntitle: "{{ frontData.title }}"\n---\n{{ contentData.heading }}';
    const offset = text.lastIndexOf('contentData') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: frontmatterSchema,
      schemaUri: 'file:///frontmatter-schema.json',
      contentSchema: bodySchema,
      contentSchemaUri: 'file:///content-schema.json',
    });

    expect(def?.uri).toBe('file:///content-schema.json');
    expect(def?.path).toBe('contentData.heading');
  });

  it('provides completions in later expression after earlier closed expression', () => {
    const text = '{{ user.name }}\n{{ user.e }}';
    const offset = text.lastIndexOf('user.e') + 'user.e'.length;

    const items = provider.getCompletions(text, offset, {
      schema: sampleSchema,
    });

    expect(items.some((item) => item.label === 'email')).toBe(true);
  });

  it('returns definition in later expression after earlier closed expression', () => {
    const text = '{{ user.name }}\n{{ user.email }}';
    const offset = text.lastIndexOf('user.email') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('user.email');
  });

  it('returns definition for the variable under cursor in multi-variable expressions', () => {
    const text = '{{ user.name }} {{ users[0].id }}';
    const offset = text.indexOf('users[0].id') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('users[0].id');
  });

  it('provides completions when cursor is at expression end boundary', () => {
    const text = '{{ user.e }}';
    const offset = text.indexOf('}}');

    const items = provider.getCompletions(text, offset, {
      schema: sampleSchema,
    });

    expect(items.some((item) => item.label === 'email')).toBe(true);
  });

  it('returns definition when cursor is at expression end boundary', () => {
    const text = '{{ user.email }}';
    const offset = text.indexOf('}}');

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('user.email');
  });

  it('provides top-level key completions in plain frontmatter YAML', () => {
    const text = ['---', 't', '---', 'body'].join('\n');
    const offset = text.indexOf('t') + 't'.length;

    const items = provider.getCompletions(text, offset, {
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          type: { type: 'string' },
        },
      },
    });

    expect(items.some((item) => item.label === 'title')).toBe(true);
    expect(items.some((item) => item.label === 'type')).toBe(true);
  });

  it('provides enum value completions in plain frontmatter YAML values', () => {
    const text = ['---', 'type: pr', '---', 'body'].join('\n');
    const offset = text.indexOf('pr') + 'pr'.length;

    const items = provider.getCompletions(text, offset, {
      schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['project', 'milestone'],
          },
        },
      },
    });

    expect(items.some((item) => item.label === 'project')).toBe(true);
    expect(items.some((item) => item.label === 'milestone')).toBe(false);
  });

  it('returns hover info for frontmatter keys', () => {
    const text = ['---', 'type: project', '---', 'body'].join('\n');
    const offset = text.indexOf('type') + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          type: { type: 'string' },
        },
      },
    });

    expect(hover?.contents).toContain('type: string');
  });

  it('returns frontmatter definition for key/value tokens outside template expressions', () => {
    const text = ['---', 'type: project', '---', 'body'].join('\n');
    const offset = text.indexOf('project') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: {
        type: 'object',
        properties: {
          type: { type: 'string' },
        },
      },
      schemaUri: 'file:///frontmatter-schema.json',
    });

    expect(def?.uri).toBe('file:///frontmatter-schema.json');
    expect(def?.path).toBe('type');
  });

  it('resolves definition to source variable when cursor is on filter', () => {
    const text = '{{ user.name | upper }}';
    const offset = text.indexOf('upper') + 1;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('user.name');
  });

  it('returns local declaration definition for loop alias variables', () => {
    const text = '{% for relationship in relationships %}{{ relationship.name }}{% endfor %}';
    const offset = text.indexOf('relationship.name') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(def?.uri).toBe('file:///workspace/project.md.tpl');
    expect(def?.range).toBeTruthy();
  });

  it('returns schema definition for iterable token in for statements', () => {
    const text = '{% for objective in objectives %}{{ objective.id }}{% endfor %}';
    const offset = text.indexOf('objectives') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: {
        type: 'object',
        properties: {
          objectives: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      },
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('objectives');
  });

  it('returns local alias declaration when cursor is on for-statement alias token', () => {
    const text = '{% for objective in objectives %}{{ objective.id }}{% endfor %}';
    const offset = text.indexOf('objective in') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: {
        type: 'object',
        properties: {
          objectives: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      },
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(def?.uri).toBe('file:///workspace/project.md.tpl');
    expect(def?.range).toBeTruthy();
  });

  it('resolves nested for iterable paths through outer aliases', () => {
    const text = [
      '{% for scope in scopes %}',
      '  {% for relationship in scope.included %}',
      '    {{ relationship.type }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('scope.included') + 'scope.'.length + 1;

    const def = provider.getDefinition(text, offset, {
      schema: {
        type: 'object',
        properties: {
          scopes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                included: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('scopes[0].included');
  });

  it('returns hover info for nested for iterable paths through outer aliases', () => {
    const text = [
      '{% for scope in scopes %}',
      '  {% for relationship in scope.included %}',
      '    {{ relationship.type }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('scope.included') + 'scope.'.length + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          scopes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                included: {
                  type: 'array',
                  description: 'Included scope relationships',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(hover?.contents).toContain('scopes[0].included');
    expect(hover?.contents).toContain('Included scope relationships');
  });

  it('returns local loop alias hover for token-only variables in statement expressions', () => {
    const text = '{% for item in users %}{% if item %}ok{% endif %}{% endfor %}';
    const offset = text.indexOf('if item') + 'if '.length + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      },
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(hover?.contents).toBe('item: local template variable');
  });

  it('returns path hover for non-token local paths in statement expressions', () => {
    const text = '{% for item in users %}{% if item.name %}ok{% endif %}{% endfor %}';
    const offset = text.indexOf('item.name') + 'item.'.length + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'User name from schema' },
              },
            },
          },
        },
      },
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(hover?.contents).toContain('name: string');
  });

  it('returns local alias hover when for-iterable path resolves to an in-scope alias token', () => {
    const text = [
      '{% for scope in scopes %}',
      '  {% for relationship in scope.included %}ok{% endfor %}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('scope.included') + 2;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          scopes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                included: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(hover?.contents).toBe('scope: local template variable');
  });

  it('returns schema hover for set-statement expression paths', () => {
    const text = '{% set title = user.name %}{{ title }}';
    const offset = text.indexOf('user.name') + 'user.'.length + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Author name from schema' },
            },
          },
        },
      },
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(hover?.contents).toContain('name: string');
  });

  it('returns schema hover for if-statement expression paths', () => {
    const text = '{% if user.name %}ok{% endif %}';
    const offset = text.indexOf('user.name') + 'user.'.length + 1;

    const hover = provider.getHover(text, offset, {
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'User name from if expression' },
            },
          },
        },
      },
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(hover?.contents).toContain('name: string');
  });

  it('resolves statement iterable definition by token segment for top-level scope paths', () => {
    const text = '{% for item in scope.included %}{{ item }}{% endfor %}';
    const scopeOffset = text.indexOf('scope.included') + 1;
    const includedOffset = text.indexOf('scope.included') + 'scope.in'.length;

    const schema = {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            included: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    };

    const scopeDef = provider.getDefinition(text, scopeOffset, {
      schema,
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });
    const includedDef = provider.getDefinition(text, includedOffset, {
      schema,
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(scopeDef?.path).toBe('scope');
    expect(includedDef?.path).toBe('scope.included');
  });

  it('resolves statement iterable hover by token segment for top-level scope paths', () => {
    const text = '{% for item in scope.included %}{{ item }}{% endfor %}';
    const scopeOffset = text.indexOf('scope.included') + 1;
    const includedOffset = text.indexOf('scope.included') + 'scope.in'.length;

    const schema = {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          description: 'Scope container',
          properties: {
            included: {
              type: 'array',
              description: 'Included items',
              items: { type: 'string' },
            },
          },
        },
      },
    };

    const scopeHover = provider.getHover(text, scopeOffset, {
      schema,
      documentUri: 'file:///workspace/project.md.tpl',
    });
    const includedHover = provider.getHover(text, includedOffset, {
      schema,
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(scopeHover?.contents).toContain('scope: object');
    expect(scopeHover?.contents).toContain('Scope container');
    expect(includedHover?.contents).toContain('scope.included: array');
    expect(includedHover?.contents).toContain('Included items');
  });

  it('returns property definition kind for frontmatter keys', () => {
    const text = ['---', 'type: project', '---', 'body'].join('\n');
    const offset = text.indexOf('type') + 1;

    const def = provider.getDefinition(text, offset, {
      schema: frontmatterSchema,
      schemaUri: 'file:///frontmatter-schema.json',
    });

    expect(def?.pathKind).toBe('property');
    expect(def?.path).toBe('type');
  });

  it('returns value definition kind and token for frontmatter values', () => {
    const text = ['---', 'type: project', '---', 'body'].join('\n');
    const offset = text.indexOf('project') + 2;

    const def = provider.getDefinition(text, offset, {
      schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['project', 'milestone'],
          },
        },
      },
      schemaUri: 'file:///frontmatter-schema.json',
    });

    expect(def?.pathKind).toBe('value');
    expect(def?.valueToken).toBe('project');
  });

  it('uses core signature metadata for filter hover descriptions', () => {
    const text = '{{ user.name | upper }}';
    const hover = provider.getHover(text, text.indexOf('upper') + 2, {
      schema: sampleSchema,
    });

    expect(hover?.contents).toContain('Convert string to uppercase');
  });

  it('resolves nested frontmatter key paths (scope.type) for hover and definition', () => {
    const schema = {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Scope type selector',
              enum: ['global', 'project'],
            },
          },
        },
      },
    };

    const text = ['---', 'scope:', '  type: project', '---', 'body'].join('\n');
    const keyOffset = text.indexOf('type:') + 1;
    const valueOffset = text.indexOf('project') + 2;

    const hover = provider.getHover(text, keyOffset, {
      schema,
      schemaUri: 'file:///frontmatter-schema.json',
    });
    expect(hover?.contents).toContain('scope.type: string');
    expect(hover?.contents).toContain('Scope type selector');

    const keyDef = provider.getDefinition(text, keyOffset, {
      schema,
      schemaUri: 'file:///frontmatter-schema.json',
    });
    expect(keyDef?.path).toBe('scope.type');
    expect(keyDef?.pathKind).toBe('property');

    const valueDef = provider.getDefinition(text, valueOffset, {
      schema,
      schemaUri: 'file:///frontmatter-schema.json',
    });
    expect(valueDef?.path).toBe('scope.type');
    expect(valueDef?.pathKind).toBe('value');
    expect(valueDef?.valueToken).toBe('project');
  });

  it('provides nested frontmatter enum completions for scope.type values', () => {
    const schema = {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['global', 'project'],
            },
          },
        },
      },
    };

    const text = ['---', 'scope:', '  type: pr', '---', 'body'].join('\n');
    const offset = text.indexOf('pr') + 2;

    const items = provider.getCompletions(text, offset, {
      schema,
      schemaUri: 'file:///frontmatter-schema.json',
    });

    expect(items.some((item) => item.label === 'project')).toBe(true);
    expect(items.some((item) => item.label === 'global')).toBe(false);
  });

  it('resolves shadowed nested loop aliases to the innermost iterable path', () => {
    const text = [
      '{% for item in items %}',
      '  {% for item in item.children %}',
      '    {{ item.na }}',
      '  {% endfor %}',
      '  {{ item.name }}',
      '{% endfor %}',
    ].join('\n');

    const innerOffset = text.indexOf('item.na') + 'item.na'.length;
    const outerOffset = text.lastIndexOf('item.name') + 2;

    const innerItems = provider.getCompletions(text, innerOffset, {
      schema: nestedScopeSchema,
    });
    const outerHover = provider.getHover(text, outerOffset, {
      schema: nestedScopeSchema,
    });

    expect(innerItems.some((item) => item.label === 'name')).toBe(true);
    expect(outerHover?.contents).toContain('items[0].name');
  });

  it('uses frontmatter and content schema sources for hover in the same document', () => {
    const text = ['---', 'frontData:', '  title: hello', '---', '{{ contentData.heading }}'].join(
      '\n'
    );

    const frontmatterOffset = text.indexOf('title:') + 1;
    const contentOffset = text.indexOf('contentData') + 2;

    const frontmatterHover = provider.getHover(text, frontmatterOffset, {
      schema: frontmatterSchema,
      schemaUri: 'file:///frontmatter-schema.json',
      contentSchema: bodySchema,
      contentSchemaUri: 'file:///content-schema.json',
    });
    const contentHover = provider.getHover(text, contentOffset, {
      schema: frontmatterSchema,
      schemaUri: 'file:///frontmatter-schema.json',
      contentSchema: bodySchema,
      contentSchemaUri: 'file:///content-schema.json',
    });

    expect(frontmatterHover?.contents).toContain('frontData.title');
    expect(contentHover?.contents).toContain('contentData.heading');
  });
});
