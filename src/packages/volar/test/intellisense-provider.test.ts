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

const titleItemsSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
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

  it('includes active for-loop alias in expression completions', () => {
    const text = '{% for item in users %}{{ it }}{% endfor %}';
    const offset = text.lastIndexOf('it') + 'it'.length;

    const items = provider.getCompletions(text, offset, { schema: sampleSchema });

    expect(items.some((item) => item.label === 'item')).toBe(true);
  });

  it('includes set variables and loop aliases in malformed-template expression completions', () => {
    const text = [
      '---',
      'invalid: bar: [{% if %}foo {% endif %}]',
      '---',
      '{% set collection = ["a", "b", "c"] %}',
      '{% for x in collection -%}',
      '{{  }}',
    ].join('\n');
    const offset = text.indexOf('{{  }}') + 3;

    const items = provider.getCompletions(text, offset, { schema: sampleSchema });

    expect(items.some((item) => item.label === 'collection')).toBe(true);
    expect(items.some((item) => item.label === 'x')).toBe(true);
  });

  it('includes active for-loop alias in statement-expression completions', () => {
    const text = '{% for item in users %}{% if it %}{% endif %}{% endfor %}';
    const offset = text.lastIndexOf('it') + 'it'.length;

    const items = provider.getCompletions(text, offset, { schema: sampleSchema });

    expect(items.some((item) => item.label === 'item')).toBe(true);
  });

  it('offers schema iterable completions in trim-marker for statements', () => {
    const text = '{%- for x in i %}';
    const offset = text.lastIndexOf('i') + 1;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'items')).toBe(true);
  });

  it('does not suggest set variables before their declaration', () => {
    const text = ['{% for x in c %}', '{% set collection = ["a", "b"] %}'].join('\n');
    const offset = text.indexOf('in c') + 'in c'.length;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'collection')).toBe(false);
  });

  it('suggests set variables after declaration in for iterable completions', () => {
    const text = ['{% set collection = ["a", "b"] %}', '{% for x in c %}'].join('\n');
    const offset = text.lastIndexOf('in c') + 'in c'.length;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'collection')).toBe(true);
  });

  it('offers schema properties for expression prefix completion', () => {
    const text = '{{ ti }}';
    const offset = text.indexOf('ti') + 'ti'.length;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'title')).toBe(true);
  });

  it('offers alias schema properties while typing an unclosed expression', () => {
    const text = ['{% for item in items %}', '{{ item.n'].join('\n');
    const offset = text.lastIndexOf('item.n') + 'item.n'.length;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'name')).toBe(true);
  });

  it('offers alias schema properties in malformed templates with leading trim-marker for loops', () => {
    const text = [
      '---',
      '"$schema": "./example.schema.json",',
      'invalid: bar: [{% if %}foo ]',
      '---',
      '{%- for item in items %}',
      '{{ item.n',
    ].join('\n');
    const offset = text.lastIndexOf('item.n') + 'item.n'.length;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'name')).toBe(true);
  });

  it('falls back to schema child properties when alias property prefix has no direct match', () => {
    const text = ['{% for item in items %}', '{{ item.hame }}', '{% endfor %}'].join('\n');
    const offset = text.lastIndexOf('item.hame') + 'item.hame'.length;

    const items = provider.getCompletions(text, offset, { schema: titleItemsSchema });

    expect(items.some((item) => item.label === 'name')).toBe(true);
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
    const hover = provider.getHover('{{ user.name | custom }}', 22, {
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

  it('returns local alias hover info inside expression blocks', () => {
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.lastIndexOf('item') + 2;

    const hover = provider.getHover(text, offset, {
      schema: sampleSchema,
    });

    expect(hover?.contents).toBe('item: local loop alias');
  });

  it('returns local alias hover info inside statement expressions', () => {
    const text = '{% for item in users %}{% if item %}ok{% endif %}{% endfor %}';
    const offset = text.indexOf('if item') + 4;

    const hover = provider.getHover(text, offset, {
      schema: sampleSchema,
    });

    expect(hover?.contents).toBe('item: local loop alias');
  });

  it('returns local variable hover info for statement iterable aliases', () => {
    const text = '{% set collection = users %}{% for item in collection %}{{ item }}{% endfor %}';
    const offset = text.indexOf('in collection') + 5;

    const hover = provider.getHover(text, offset, {
      schema: sampleSchema,
    });

    expect(hover?.contents).toBe('collection: local template variable');
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

  it('deduplicates completion items that share the same label, kind, and detail', () => {
    const dedupeProvider = new IntellisenseProvider({
      resolveScopedPath: (_text, basePath) => basePath,
      getChildCompletions: () => [
        { label: 'x', kind: 'variable', detail: 'local loop alias' },
        { label: 'x', kind: 'variable', detail: 'local loop alias' },
        { label: 'y', kind: 'variable', detail: 'string' },
      ],
      getEnumValueCompletions: () => [],
      getPathDetails: () => null,
      resolvePathDefinition: () => null,
      resolveDocumentDefinition: () => null,
      resolveLocalAliasDefinition: (text, alias, offset) => {
        if (alias !== 'x') {
          return null;
        }
        const at = text.indexOf('{{ x }}');
        if (offset < at || at === -1) {
          return null;
        }

        const decl = text.indexOf('for x in');
        return decl === -1
          ? null
          : {
              start: decl + 'for '.length,
              end: decl + 'for x'.length,
            };
      },
    });

    const text = '{% for x in users %}{{ x }}{% endfor %}';
    const offset = text.indexOf('{{ x }}') + 3;
    const completions = dedupeProvider.getCompletions(text, offset, {
      schema: sampleSchema,
    });

    const xEntries = completions.filter(
      (item) => item.label === 'x' && item.kind === 'variable' && item.detail === 'local loop alias'
    );
    expect(xEntries).toHaveLength(1);
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

  it('resolves statement expression property access through schema navigation', () => {
    const text =
      '{% for relationship in relationships %}{% if relationship.name %}ok{% endif %}{% endfor %}';
    const offset = text.indexOf('relationship.name') + 13;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('relationships[0].name');
  });

  it('falls through to schema definition for property access on local aliases', () => {
    const text = '{% for item in items %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 6;

    const def = provider.getDefinition(text, offset, {
      schema: sampleSchema,
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///workspace/project.md.tpl',
    });

    expect(def?.uri).toBe('file:///schema.json');
    expect(def?.path).toBe('items[0].name');
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
    const hover = provider.getHover('{{ user.name | upper }}', 20, {
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

  describe('regression: intellisense on complex iterable expressions (WI-062 drift prevention)', () => {
    it('provides completions for loop alias on computed bracket expressions', () => {
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
      const text = '{% for user in users[activeIndex + 1] %}{{ user.| }}{% endfor %}';
      const cursor = text.indexOf('user.|') + 5;

      const completions = provider.getCompletions(text, cursor, { schema: schema as object });
      expect(completions?.some((item) => item.label === 'name')).toBe(true);
    });

    it('provides hover info for loop alias on spaced for-in header', () => {
      const schema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: { email: { type: 'string' } },
            },
          },
        },
      };
      const text = '{% for   user   in   users   %}{{ user| }}{% endfor %}';
      const cursor = text.indexOf('user|') + 4;

      const hover = provider.getHover(text, cursor, { schema: schema as object });
      expect(hover?.contents).toContain('user');
    });

    it('provides definition for loop alias used in nested scope with complex outer iterable', () => {
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
        '{% for group in groups %}{% for member in group.members %}{{ member| }}{% endfor %}{% endfor %}';
      const cursor = text.indexOf('member|') + 6;

      const definition = provider.getDefinition(text, cursor, { schema: schema as object });
      expect(definition).toBeDefined();
    });

    it('returns hover info for loop alias even when iterable offset is complex', () => {
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
      const text = '{% for user in users[activeIndex] %}{{ user| }}{% endfor %}';
      const cursor = text.indexOf('user|') + 4;

      const hover = provider.getHover(text, cursor, { schema: schema as object });
      // Should successfully resolve the alias to its array-item schema
      expect(hover?.contents).toBeDefined();
    });
  });
});
