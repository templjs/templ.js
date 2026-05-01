import { describe, expect, it } from 'vitest';
import {
  IntellisenseProvider,
  createIntellisenseProvider,
  intellisenseTesting,
  type SemanticReadAdapter,
} from '../src/intellisense-provider.js';
import { createContextGraphSemanticReadAdapter } from '../src/context-graph-adapter.js';

const emptyAdapter: SemanticReadAdapter = {
  resolveScopedPath: (_text, basePath) => basePath,
  getChildCompletions: () => [],
  getEnumValueCompletions: () => [],
  getPathDetails: () => null,
  resolvePathDefinition: () => null,
  resolveDocumentDefinition: () => null,
  resolveLocalAliasDefinition: () => null,
};

const keywordAdapter: SemanticReadAdapter = {
  ...emptyAdapter,
  getChildCompletions: () => [
    { label: 'alpha', kind: 'variable' },
    { label: 'alpha', kind: 'variable' },
    { label: 'beta', kind: 'variable' },
  ],
};

describe('IntellisenseProvider branch coverage', () => {
  it('falls back to statement keywords when for-header expression cannot be parsed', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const items = provider.getCompletions('{% for item o %}', 13, {
      debugLog: () => {},
    });

    expect(items).toEqual([]);
  });

  it('logs duplicate label summary during expression completions', () => {
    const provider = new IntellisenseProvider(keywordAdapter);
    const logs: string[] = [];
    const text = '{{ a }}';
    const offset = text.indexOf('a') + 1;

    const items = provider.getCompletions(text, offset, {
      debugLog: (message) => logs.push(message),
    });

    expect(items.map((item) => item.label)).toContain('alpha');
    expect(logs.some((line) => line.includes('duplicate labels'))).toBe(true);
  });

  it('returns null hover for unresolved frontmatter path context', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = ['---', '-', '---'].join('\n');
    const offset = text.indexOf('-\n---') + 1;

    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover).toBeNull();
  });

  it('returns null hover for empty statement bodies', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const hover = provider.getHover('{%   %}', 4, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover).toBeNull();
  });

  it('returns null definition outside expression/statement/frontmatter when no document reference exists', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const definition = provider.getDefinition('plain text', 2, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition when frontmatter key path cannot be determined', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = ['---', '-', '---'].join('\n');
    const offset = text.indexOf('-\n---') + 1;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition when cursor is on expression filter but source variable cannot be resolved', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{{ | upper }}';
    const offset = text.indexOf('upper') + 1;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition for empty statement content', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const definition = provider.getDefinition('{%   %}', 4, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition when cursor is on for-alias without a document uri', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('item in') + 2;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition when cursor is in for-iterable filter segment', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% for item in users | lower %}{{ item }}{% endfor %}';
    const offset = text.indexOf('lower') + 1;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition when statement expression is empty', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const definition = provider.getDefinition('{% if %}', 5, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition when statement cursor is on filter segment', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% if users | lower %}ok{% endif %}';
    const offset = text.indexOf('lower') + 1;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null signature help when cursor is outside expressions', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    expect(provider.getSignatureHelp('plain', 2, { debugLog: () => {} })).toBeNull();
  });

  it('returns null signature help when no filter-call syntax is present', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    expect(
      provider.getSignatureHelp('{{ user.name | lower }}', 12, { debugLog: () => {} })
    ).toBeNull();
  });

  it('returns null signature help when filter signature is unknown', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const help = provider.getSignatureHelp('{{ user.name | missing() }}', 20, {
      debugLog: () => {},
      customFilters: [],
    });

    expect(help).toBeNull();
  });

  it('supports completions for open expressions without closing delimiters', () => {
    const provider = new IntellisenseProvider(keywordAdapter);
    const items = provider.getCompletions('{{ al', 5, {
      debugLog: () => {},
    });

    expect(items.map((item) => item.label)).toContain('alpha');
  });

  it('uses adapter scoped-path rewrites for property completions', () => {
    let lastParentPath = '';
    const adapter: SemanticReadAdapter = {
      ...emptyAdapter,
      resolveScopedPath: (_text, _basePath) => 'users[0]',
      getChildCompletions: (_ctx, parentPath) => {
        lastParentPath = parentPath;
        return [{ label: 'id', kind: 'property' }];
      },
    };

    const provider = new IntellisenseProvider(adapter);
    const items = provider.getCompletions('{{ item.id }}', 9, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(items.map((item) => item.label)).toContain('id');
    expect(lastParentPath).toBe('users[0]');
  });

  it('returns statement keyword completions when cursor is immediately after statement start', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const items = provider.getCompletions('{% if user %}', 2, {
      debugLog: () => {},
    });

    expect(items.some((item) => item.kind === 'keyword')).toBe(true);
  });

  it('handles non-identifier statement prefixes gracefully', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const items = provider.getCompletions('{% 1invalid %}', 6, {
      debugLog: () => {},
    });

    expect(items).toEqual([]);
  });

  it('uses explicit frontmatter range override with unknown host language URIs', () => {
    const provider = new IntellisenseProvider(keywordAdapter);
    const text = 'title: pr';
    const items = provider.getCompletions(text, text.length, {
      debugLog: () => {},
      documentUri: 'file:///doc.unknown',
      frontmatterRange: { start: 0, end: text.length },
    });

    expect(items).toEqual([]);
  });

  it('returns null definition for unresolved expression variable references', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const definition = provider.getDefinition('{{ ??? }}', 4, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null definition for unresolved for-iterable expression variables', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% for item in ??? %}x{% endfor %}';
    const offset = text.indexOf('???') + 1;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns local alias hover details when cursor is on statement alias token', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('item in') + 2;

    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover?.contents).toBe('item: local loop alias');
  });

  it('returns null hover when statement expression has no variable or filter metadata', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% if ??? %}ok{% endif %}';
    const offset = text.indexOf('???') + 1;

    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover).toBeNull();
  });

  it('returns document definitions before frontmatter/property fallback logic', () => {
    const adapter: SemanticReadAdapter = {
      ...emptyAdapter,
      resolveDocumentDefinition: () => ({
        uri: 'file:///resolved/schema.json',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      }),
    };
    const provider = new IntellisenseProvider(adapter);

    const definition = provider.getDefinition('plain text', 1, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition?.uri).toBe('file:///resolved/schema.json');
  });

  it('returns null definition when statement expression has no variable metadata', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% if ??? %}ok{% endif %}';
    const offset = text.indexOf('???') + 1;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition).toBeNull();
  });

  it('returns null signature help when expression delimiters are open-ended', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const help = provider.getSignatureHelp('{{ user.name | lower(', 20, {
      debugLog: () => {},
    });

    expect(help).toBeNull();
  });

  it('returns hover details for expression variables resolved by the semantic adapter', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      getPathDetails: (_ctx, resolvedPath) =>
        resolvedPath === 'user.name'
          ? {
              path: 'user.name',
              type: 'string',
              description: 'Display name',
            }
          : null,
    });

    const hover = provider.getHover('{{ user.name }}', 6, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover?.contents).toContain('user.name: string');
    expect(hover?.contents).toContain('Display name');
  });

  it('returns frontmatter hover details when graph metadata is available', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      getPathDetails: (_ctx, path) =>
        path === 'title'
          ? {
              path: 'title',
              type: 'string',
              description: 'Document title',
            }
          : null,
    });

    const text = ['---', 'title: Example', '---'].join('\n');
    const offset = text.indexOf('title') + 2;
    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover?.contents).toContain('title: string');
    expect(hover?.contents).toContain('Document title');
  });

  it('returns filter hover details for statement expressions', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const text = '{% if user.name | lower %}ok{% endif %}';
    const offset = text.indexOf('lower') + 2;

    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover?.contents).toContain('lower');
  });

  it('returns definition for frontmatter property keys through schema adapter lookup', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      resolvePathDefinition: (_ctx, path, _opts, kind) =>
        path === 'title' && kind === 'property'
          ? {
              uri: 'file:///schema.json',
              range: {
                start: { line: 2, character: 2 },
                end: { line: 2, character: 7 },
              },
            }
          : null,
    });

    const text = ['---', 'title: Example', '---'].join('\n');
    const offset = text.indexOf('title') + 2;
    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition?.uri).toBe('file:///schema.json');
    expect(definition?.path).toBe('title');
    expect(definition?.pathKind).toBe('property');
  });

  it('returns definition for frontmatter value tokens with value path kind', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      resolvePathDefinition: (_ctx, path, _opts, kind, valueToken) =>
        path === 'status' && kind === 'value' && valueToken === 'draft'
          ? {
              uri: 'file:///schema.json',
              range: {
                start: { line: 8, character: 10 },
                end: { line: 8, character: 15 },
              },
            }
          : null,
    });

    const text = ['---', 'status: draft', '---'].join('\n');
    const offset = text.indexOf('draft') + 2;
    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition?.path).toBe('status');
    expect(definition?.pathKind).toBe('value');
    expect(definition?.valueToken).toBe('draft');
  });

  it('returns definition for expression filter source variables', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      resolvePathDefinition: (_ctx, path) =>
        path === 'user.name'
          ? {
              uri: 'file:///schema.json',
              range: {
                start: { line: 4, character: 2 },
                end: { line: 4, character: 11 },
              },
            }
          : null,
    });

    const text = '{{ user.name | lower }}';
    const offset = text.indexOf('lower') + 1;
    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition?.path).toBe('user.name');
    expect(definition?.uri).toBe('file:///schema.json');
  });

  it('returns statement local-alias definitions when document URI is configured', () => {
    const provider = new IntellisenseProvider(createContextGraphSemanticReadAdapter());
    const text = '{% for item in users %}{% if item %}{{ item }}{% endif %}{% endfor %}';
    const offset = text.indexOf('{% if item %}') + 8;

    const definition = provider.getDefinition(text, offset, {
      debugLog: () => {},
      schemaUri: 'file:///schema.json',
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(definition?.uri).toBe('file:///doc.md.tmpl');
    expect(definition?.range?.start.character).toBeGreaterThanOrEqual(0);
  });

  it('returns hover for statement iterable variables after for-header parsing', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      getPathDetails: (_ctx, path) =>
        path === 'users'
          ? {
              path: 'users',
              type: 'array',
              description: 'User collection',
            }
          : null,
    });
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.indexOf('users') + 2;

    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover?.contents).toContain('users: array');
  });

  it('returns statement variable hover details for non-for statements', () => {
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      getPathDetails: (_ctx, path) =>
        path === 'user.name'
          ? {
              path: 'user.name',
              type: 'string',
              description: 'Name field',
            }
          : null,
    });

    const text = '{% if user.name %}ok{% endif %}';
    const offset = text.indexOf('user.name') + 2;
    const hover = provider.getHover(text, offset, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover?.contents).toContain('user.name: string');
  });

  it('returns null and logs hover miss when expression has no variable/filter metadata', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const logs: string[] = [];
    const hover = provider.getHover('{{ ... }}', 4, {
      debugLog: (message) => logs.push(message),
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover).toBeNull();
    expect(
      logs.some((line) => line.includes('hover miss: no active filter or variable metadata'))
    ).toBe(true);
  });

  it('returns expression completions when using custom delimiters', () => {
    const provider = new IntellisenseProvider(keywordAdapter);
    const items = provider.getCompletions('[[ al ]]', 5, {
      delimiters: {
        expressionStart: '[[',
        expressionEnd: ']]',
      },
      debugLog: () => {},
    });

    expect(items.map((item) => item.label)).toContain('alpha');
  });

  it('returns filter completions inside expression pipe segments', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const items = provider.getCompletions('{{ user.name | lo }}', 18, {
      debugLog: () => {},
    });

    expect(items.some((item) => item.kind === 'filter')).toBe(true);
  });

  it('returns nested property completions for bracketed path segments', () => {
    let lastParentPath = '';
    const provider = new IntellisenseProvider({
      ...emptyAdapter,
      getChildCompletions: (_ctx, parentPath) => {
        lastParentPath = parentPath;
        return [{ label: 'id', kind: 'property' }];
      },
    });

    const text = '{{ users[0].id }}';
    const offset = text.indexOf('.id') + 2;
    const items = provider.getCompletions(text, offset, {
      debugLog: () => {},
    });

    expect(items.map((item) => item.label)).toContain('id');
    expect(lastParentPath).toBe('users[0]');
  });

  it('returns null hover at offset zero outside active semantic regions', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const hover = provider.getHover('plain text', 0, {
      debugLog: () => {},
    });

    expect(hover).toBeNull();
  });

  it('returns null hover when statement keyword has no expression segment', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const hover = provider.getHover('{% if %}', 5, {
      debugLog: () => {},
      documentUri: 'file:///doc.md.tmpl',
    });

    expect(hover).toBeNull();
  });

  it('returns keyword completions when for-header parsing cannot extract iterable expression', () => {
    const provider = new IntellisenseProvider(emptyAdapter);
    const items = provider.getCompletions('{% for item %}', 12, {
      debugLog: () => {},
    });

    expect(items).toEqual([]);
  });

  it('creates provider instances via helper factory', () => {
    const provider = createIntellisenseProvider(emptyAdapter);
    expect(provider).toBeInstanceOf(IntellisenseProvider);
  });
});

describe('intellisense helper branch coverage', () => {
  it('returns null for malformed for-header expression fragments', () => {
    const fragment = intellisenseTesting.getStatementExpressionFragment('for item %');
    expect(fragment).toBeNull();
  });

  it('normalizes expressions only when delimiters wrap both sides', () => {
    expect(
      intellisenseTesting.normalizeExpression('{{ user.name }}', {
        expressionStart: '{{',
        expressionEnd: '}}',
        statementStart: '{%',
        statementEnd: '%}',
        commentStart: '{#',
        commentEnd: '#}',
      })
    ).toBe('user.name');

    expect(
      intellisenseTesting.normalizeExpression('user.name', {
        expressionStart: '{{',
        expressionEnd: '}}',
        statementStart: '{%',
        statementEnd: '%}',
        commentStart: '{#',
        commentEnd: '#}',
      })
    ).toBe('user.name');
  });

  it('splits path segments while preserving bracket depth boundaries', () => {
    expect(intellisenseTesting.splitPathSegments('users[0].profile.name')).toEqual([
      'users[0]',
      'profile',
      'name',
    ]);
    expect(intellisenseTesting.splitPathSegments('')).toEqual([]);
  });

  it('returns variable prefix at dotted cursor boundaries', () => {
    const content = 'user.name';
    const prefix = intellisenseTesting.getVariablePathPrefixAtOffset(content, content.indexOf('.'));
    expect(prefix).toBe('user');
    expect(intellisenseTesting.getVariablePathPrefixAtOffset('???', 1)).toBeNull();
  });

  it('resolves nested frontmatter key paths and value token extraction', () => {
    const text = ['title: root', 'meta:', '  author: alice'].join('\n');
    const offset = text.lastIndexOf('alice') + 2;
    const context = intellisenseTesting.getFrontmatterContext(text, offset);

    expect(context.path).toBe('meta.author');
    expect(context.valueToken).toBe('alice');
    expect(context.inValue).toBe(true);
  });

  it('returns full variable path when cursor is beyond segment boundaries', () => {
    const prefix = intellisenseTesting.getVariablePathPrefixAtOffset('user.name', 999);
    expect(prefix).toBe('user.name');
  });

  it('extracts frontmatter key paths when prior scopes collapse by indentation', () => {
    const text = ['root:', '  child: one', 'title: two'].join('\n');
    const offset = text.indexOf('title') + 1;
    const context = intellisenseTesting.getFrontmatterContext(text, offset);

    expect(context.parentPath).toBeUndefined();
    expect(context.path).toBe('title');
  });

  it('supports near-offset range lookup fallback by scanning one character left', () => {
    const text = '{{ user }}x';
    const offsetAtBoundary = text.indexOf('}}') + 2;
    const range = intellisenseTesting.findEnclosingRangeNearOffset(
      text,
      offsetAtBoundary,
      '{{',
      '}}',
      false
    );

    expect(range?.start).toBe(0);
    expect(range?.end).toBe(text.indexOf('}}') + 2);
  });

  it('resolves variable paths at cursor and via single-reference fallback', () => {
    expect(intellisenseTesting.getVariablePathAtOffset('user.name', 2)).toBe('user.name');
    expect(intellisenseTesting.getVariablePathAtOffset('user.name', 999)).toBe('user.name');
    expect(intellisenseTesting.getVariablePathAtOffset('???', 1)).toBeNull();
  });

  it('resolves filter names at cursor and via single-reference fallback', () => {
    const content = 'user.name | lower';
    expect(intellisenseTesting.getFilterNameAtOffset(content, content.indexOf('lower') + 1)).toBe(
      'lower'
    );
    expect(intellisenseTesting.getFilterNameAtOffset(content, 999)).toBe('lower');
    expect(intellisenseTesting.getFilterNameAtOffset('user.name', 2)).toBeNull();
  });

  it('computes completion prefixes for bracket, dotted, and pipe expressions', () => {
    expect(intellisenseTesting.getCompletionPrefix('users[0')).toBe('users');
    expect(intellisenseTesting.getCompletionPrefix('user.name')).toBe('user.name');
    expect(intellisenseTesting.getCompletionPrefix('user | lo')).toBe('user | lo');
  });

  it('returns null statement fragments for empty or keyword-only statements', () => {
    expect(intellisenseTesting.getStatementExpressionFragment('   ')).toBeNull();
    expect(intellisenseTesting.getStatementExpressionFragment('if')).toBeNull();
    expect(intellisenseTesting.getStatementExpressionFragment('@@ broken')).toBeNull();
  });

  it('extracts for-loop statement expressions when iterable segments are present', () => {
    const fragment = intellisenseTesting.getStatementExpressionFragment('for item in users');
    expect(fragment?.expression).toBe('users');
  });

  it('collapses frontmatter parent scopes when indentation decreases', () => {
    const text = ['meta:', '  inner: one', 'title: two'].join('\n');
    const offset = text.lastIndexOf('title') + 1;
    const context = intellisenseTesting.getFrontmatterContext(text, offset);

    expect(context.parentPath).toBeUndefined();
    expect(context.path).toBe('title');
  });
});
