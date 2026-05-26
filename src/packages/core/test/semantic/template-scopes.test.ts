import { describe, expect, it, vi } from 'vitest';
import type { LexerOptions, PathSegment } from '../../src/index.js';
import { extractTemplateBindings, getTemplateBindingsAtOffset } from '../../src/index.js';
import { pathSegmentToString } from '../../src/semantic/template-scopes.js';

describe('template-scopes helpers', () => {
  it('converts path segments into normalized scope path tokens', () => {
    const property: PathSegment = { type: 'property', value: 'profile' };
    const stringIndex: PathSegment = { type: 'index', value: '2' };
    const literalIndex: PathSegment = {
      type: 'index',
      value: {
        type: 'literal',
        valueType: 'number',
        value: 3,
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
    };
    const literalStringIndex: PathSegment = {
      type: 'index',
      value: {
        type: 'literal',
        valueType: 'string',
        value: 'name',
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
    };
    const computedIndex: PathSegment = {
      type: 'index',
      value: {
        type: 'variable',
        name: 'idx',
        path: [],
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
    };

    expect(pathSegmentToString(property)).toBe('.profile');
    expect(pathSegmentToString(stringIndex)).toBe('[2]');
    expect(pathSegmentToString(literalIndex)).toBe('[3]');
    expect(pathSegmentToString(literalStringIndex)).toBe('[name]');
    expect(pathSegmentToString(computedIndex)).toBe('[0]');
  });

  it('extracts loop bindings from standard delimiters', () => {
    const template = '{% for item in users %}{{ item.name }}{% endfor %}';
    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
      })
    );
    expect(bindings[0].scopeStartOffset).toBeGreaterThan(bindings[0].declarationEndOffset ?? 0);
    expect(bindings[0].scopeEndOffset).toBeGreaterThan(bindings[0].scopeStartOffset);
  });

  it('extracts nested bindings from if, block, and filtered iterables', () => {
    const template = [
      '{% block body %}',
      '{% if users %}',
      '{% for item in (users | reverse) %}',
      '{{ item.name }}',
      '{% endfor %}',
      '{% endif %}',
      '{% endblock %}',
    ].join('');

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
      })
    );
  });

  it('uses opening tag end as scope start when a loop body is empty', () => {
    const template = '{% for item in users %}{% endfor %}';
    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0].scopeStartOffset).toBeGreaterThanOrEqual(
      bindings[0].declarationEndOffset ?? 0
    );
  });

  it('supports custom delimiters and maps offsets back to the original template', () => {
    const template = '<% for item in users %><< item.name >><% endfor %>';
    const options: LexerOptions = {
      delimiters: {
        statement_start: '<%',
        statement_end: '%>',
        expression_start: '<<',
        expression_end: '>>',
        comment_start: '<#',
        comment_end: '#>',
      },
    };

    const bindings = extractTemplateBindings(template, options);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
      })
    );
    expect(bindings[0].declarationStartOffset).toBe(template.indexOf('item in users'));
  });

  it('extracts both aliases from key-value loop bindings', () => {
    const template = '{% for key, value in environment_vars %}{{ key }}={{ value }}{% endfor %}';
    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'key', sourcePath: 'environment_vars' }),
        expect.objectContaining({ name: 'value', sourcePath: 'environment_vars' }),
      ])
    );
  });

  it('extracts set-variable bindings and resolves in-scope bindings at offset', () => {
    const template = [
      '{% if condition %}',
      '{% set local = user.profile.name %}',
      '{{ local }}',
      '{% endif %}',
      '{{ local }}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);
    const setBinding = bindings.find((binding) => binding.kind === 'set-variable');

    expect(setBinding).toBeDefined();
    expect(setBinding).toEqual(
      expect.objectContaining({
        kind: 'set-variable',
        name: 'local',
        sourcePath: 'user.profile.name',
      })
    );

    const localInsideIfOffset = template.indexOf('{{ local }}') + 4;
    const localOutsideIfOffset = template.lastIndexOf('{{ local }}') + 4;

    expect(
      getTemplateBindingsAtOffset(bindings, localInsideIfOffset).some(
        (binding) => binding.name === 'local'
      )
    ).toBe(true);
    expect(
      getTemplateBindingsAtOffset(bindings, localOutsideIfOffset).some(
        (binding) => binding.name === 'local'
      )
    ).toBe(false);
  });

  it('infers object-literal member paths for set-variable bindings', () => {
    const template =
      '{% set profile = { name: "Ada", meta: { city: "London" } } %}{{ profile.name }}';
    const bindings = extractTemplateBindings(template);
    const setBinding = bindings.find((binding) => binding.kind === 'set-variable');

    expect(setBinding?.name).toBe('profile');
    expect(setBinding?.inferredPaths).toEqual(['meta', 'meta.city', 'name']);
  });

  it('infers nested object-literal paths while ignoring unsupported keys', () => {
    const template =
      '{% set profile = { "": "skip", name: "Ada", meta: { city: "London", note: "A, B" }, tags: [1, 2] } %}{{ profile.meta.city }}';
    const bindings = extractTemplateBindings(template);
    const setBinding = bindings.find((binding) => binding.kind === 'set-variable');

    expect(setBinding?.inferredPaths).toEqual(['meta', 'meta.city', 'meta.note', 'name', 'tags']);
  });

  it('infers object-literal member paths for single-alias for bindings', () => {
    const template =
      '{% for item in { name: "Ada", meta: { city: "London" } } %}{{ item.meta.city }}{% endfor %}';
    const bindings = extractTemplateBindings(template);
    const forBinding = bindings.find((binding) => binding.kind === 'for-alias');

    expect(forBinding?.name).toBe('item');
    expect(forBinding?.inferredPaths).toEqual(['meta', 'meta.city', 'name']);
  });

  it('assigns inferred paths to for value aliases while leaving key aliases undefined', () => {
    const template =
      '{% for key, value in { name: "Ada", meta: { city: "London" } } %}{{ value.meta.city }}{% endfor %}';
    const bindings = extractTemplateBindings(template);
    const keyBinding = bindings.find((binding) => binding.kind === 'for-alias');
    const valueBinding = bindings.find((binding) => binding.kind === 'for-value-alias');

    expect(keyBinding?.name).toBe('key');
    expect(keyBinding?.inferredPaths).toBeUndefined();
    expect(valueBinding?.name).toBe('value');
    expect(valueBinding?.inferredPaths).toEqual(['meta', 'meta.city', 'name']);
  });

  it('retains single-alias for bindings for empty object-literal iterables', () => {
    const template = '{% for item in {} %}{{ item }}{% endfor %}';
    const bindings = extractTemplateBindings(template);
    const forBinding = bindings.find((binding) => binding.kind === 'for-alias');

    expect(forBinding?.name).toBe('item');
    expect(forBinding?.sourceExpression).toBe('{}');
    expect(forBinding?.inferredPaths).toEqual([]);
  });

  it('retains value aliases for key-value loops over empty object-literal iterables', () => {
    const template = '{% for key, value in {} %}{{ value }}{% endfor %}';
    const bindings = extractTemplateBindings(template);
    const keyBinding = bindings.find((binding) => binding.kind === 'for-alias');
    const valueBinding = bindings.find((binding) => binding.kind === 'for-value-alias');

    expect(keyBinding?.name).toBe('key');
    expect(keyBinding?.inferredPaths).toBeUndefined();
    expect(valueBinding?.name).toBe('value');
    expect(valueBinding?.sourceExpression).toBe('{}');
    expect(valueBinding?.inferredPaths).toEqual([]);
  });

  it('sorts overlapping in-scope bindings by nearest scope start offset', () => {
    const bindings = [
      {
        kind: 'for-alias' as const,
        name: 'outer',
        sourcePath: 'users',
        scopeStartOffset: 0,
        scopeEndOffset: 100,
      },
      {
        kind: 'set-variable' as const,
        name: 'inner',
        sourcePath: 'users[0]',
        scopeStartOffset: 10,
        scopeEndOffset: 50,
      },
    ];

    const inScope = getTemplateBindingsAtOffset(bindings, 20);

    expect(inScope.map((binding) => binding.name)).toEqual(['inner', 'outer']);
  });

  it('handles empty custom comment delimiters while normalizing loop delimiters', () => {
    const template = '<% for item in users %><< item >><% endfor %>';
    const options: LexerOptions = {
      delimiters: {
        statement_start: '<%',
        statement_end: '%>',
        expression_start: '<<',
        expression_end: '>>',
        comment_start: '',
        comment_end: '',
      },
    };

    const bindings = extractTemplateBindings(template, options);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
      })
    );
  });

  it('skips loop bindings when the iterable cannot be normalized to a path', () => {
    const template = '{% for item in helper(users) %}{{ item }}{% endfor %}';
    expect(extractTemplateBindings(template)).toEqual([]);
  });

  it('normalizes computed iterable indexes to [0]', () => {
    const template = '{% for item in users[item + 1] %}{{ item }}{% endfor %}';
    expect(extractTemplateBindings(template)).toEqual([
      expect.objectContaining({ name: 'item', sourcePath: 'users[0]' }),
    ]);
  });

  it('normalizes spaced computed iterable expressions to [0] indices', () => {
    const template = '{% for item in users[activeIndex + 1] %}{{ item }}{% endfor %}';

    expect(extractTemplateBindings(template)).toEqual([
      expect.objectContaining({ name: 'item', sourcePath: 'users[0]' }),
    ]);
  });

  it('normalizes quoted iterable index segments while retaining embedded spaces', () => {
    const template = '{% for item in users["full name"] %}{{ item }}{% endfor %}';

    expect(extractTemplateBindings(template)).toEqual([
      expect.objectContaining({ name: 'item', sourcePath: 'users[full name]' }),
    ]);
  });

  it('normalizes fallback iterable paths for quoted, numeric, and computed indexes', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings(
      [
        '{% for named in users["name"] %}{% endfor %}',
        '{% for indexed in users[2] %}{% endfor %}',
        '{% for computed in users[item + 1] %}{% endfor %}',
      ].join('')
    );

    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'named', sourcePath: 'users[name]' }),
        expect.objectContaining({ name: 'indexed', sourcePath: 'users[2]' }),
        expect.objectContaining({ name: 'computed', sourcePath: 'users[0]' }),
      ])
    );
  });

  it('returns an empty list when parsing throws unexpectedly', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: () => {
        throw new Error('tokenize failed');
      },
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% for item in users %}{% endfor %}')).toEqual([]);
  });

  it('returns an empty list when parsing succeeds without an AST', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% for item in users %}{% endfor %}')).toEqual([]);
  });

  it('retains recovered fallback loops with source expressions even when path normalization fails', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% for item in   | reverse %}{% endfor %}')).toEqual([
      expect.objectContaining({
        name: 'item',
        sourcePath: undefined,
        sourceExpression: '| reverse',
      }),
    ]);
    expect(module.extractTemplateBindings('{% for item in +1 %}{% endfor %}')).toEqual([
      expect.objectContaining({
        name: 'item',
        sourcePath: undefined,
        sourceExpression: '+1',
      }),
    ]);
  });

  it('handles declaration extraction fallback when opening tags cannot be matched', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 8 },
          children: [
            {
              type: 'for',
              iterator: 'item',
              iterable: {
                type: 'variable',
                name: 'users',
                path: [],
                start: { line: 2, column: 0 },
                end: { line: 2, column: 5 },
              },
              body: [],
              start: { line: 2, column: 1 },
              end: { line: 4, column: 0 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('plain')).toEqual([
      {
        kind: 'for-alias',
        name: 'item',
        sourcePath: 'users',
        sourceExpression: 'users',
        scopeStartOffset: 'plain'.length,
        scopeEndOffset: 'plain'.length,
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      },
    ]);
  });

  it('handles declaration extraction fallback when opening tags do not match for-syntax', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 20 },
          children: [
            {
              type: 'for',
              iterator: 'item',
              iterable: {
                type: 'variable',
                name: 'users',
                path: [],
                start: { line: 1, column: 0 },
                end: { line: 1, column: 5 },
              },
              body: [],
              start: { line: 1, column: 0 },
              end: { line: 1, column: 10 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('nonsense %}')).toEqual([
      {
        kind: 'for-alias',
        name: 'item',
        sourcePath: 'users',
        sourceExpression: 'users',
        scopeStartOffset: 11,
        scopeEndOffset: 10,
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      },
    ]);
  });

  it('maps zero offsets through delimiter normalization lower-bound logic', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 1 },
          children: [
            {
              type: 'for',
              iterator: 'item',
              iterable: {
                type: 'variable',
                name: 'users',
                path: [],
                start: { line: 1, column: 0 },
                end: { line: 1, column: 5 },
              },
              body: [
                {
                  type: 'text',
                  value: '',
                  raw: '',
                  start: { line: 1, column: 0 },
                  end: { line: 1, column: 0 },
                },
              ],
              start: { line: 1, column: 0 },
              end: { line: 1, column: 0 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('x')).toEqual([
      {
        kind: 'for-alias',
        name: 'item',
        sourcePath: 'users',
        sourceExpression: 'users',
        scopeStartOffset: 0,
        scopeEndOffset: 0,
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      },
    ]);
  });

  it('falls back when name lookup cannot be found in a matched opening tag', () => {
    const originalIndexOf = String.prototype.indexOf;
    const indexOfSpy = vi.spyOn(String.prototype, 'indexOf').mockImplementation(function (
      searchString: string,
      position?: number
    ): number {
      if (
        this.toString().includes('for item in users') &&
        searchString === 'item' &&
        typeof position === 'number'
      ) {
        return -1;
      }

      return originalIndexOf.call(this.toString(), searchString, position);
    });

    const template = '{% for item in users %}{{ item }}{% endfor %}';
    let bindings: ReturnType<typeof extractTemplateBindings>;
    try {
      bindings = extractTemplateBindings(template);
    } finally {
      indexOfSpy.mockRestore();
    }

    expect(bindings).toHaveLength(1);
    expect(bindings[0].declarationStartOffset).toBe(7);
    expect(bindings[0].declarationEndOffset).toBe(11);
  });

  it('gracefully handles malformed offset and declaration metadata from parsed loops', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
          children: [
            {
              type: 'for',
              iterator: 'item',
              iterable: {
                type: 'variable',
                name: 'users',
                path: [],
                start: { line: 1, column: 0 },
                end: { line: 1, column: 5 },
              },
              body: [],
              start: { line: 4, column: 2 },
              end: { line: 6, column: 0 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(
      module.extractTemplateBindings('plain text', {
        delimiters: {
          statement_start: '<%',
          statement_end: '%>',
          expression_start: '<<',
          expression_end: '>>',
          comment_start: '',
          comment_end: '',
        },
      })
    ).toEqual([
      {
        kind: 'for-alias',
        name: 'item',
        sourcePath: 'users',
        sourceExpression: 'users',
        scopeStartOffset: 'plain text'.length,
        scopeEndOffset: 'plain text'.length,
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      },
    ]);
  });

  it('skips bindings when the loop iterable cannot be converted into a path', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
          children: [
            {
              type: 'for',
              iterator: 'item',
              iterable: {
                type: 'literal',
                valueType: 'number',
                value: 1,
                start: { line: 1, column: 0 },
                end: { line: 1, column: 1 },
              },
              body: [],
              start: { line: 1, column: 0 },
              end: { line: 1, column: 10 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('plain text')).toEqual([]);
  });

  it('extends fallback loop bindings to the end of the template when an endfor is missing', () => {
    const template = '{% for item in users %}{{ item }}';
    const bindings = extractTemplateBindings(template);

    expect(bindings).toEqual([
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
        scopeStartOffset: 23,
        scopeEndOffset: template.length,
      }),
    ]);
  });

  it('returns no fallback bindings for unterminated for statements', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% for item in users')).toEqual([]);
  });

  it('maps recovered fallback bindings back to original offsets with custom delimiters', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const template = '<% for item in users %><< item >>';
    expect(
      module.extractTemplateBindings(template, {
        delimiters: {
          statement_start: '<%',
          statement_end: '%>',
          expression_start: '<<',
          expression_end: '>>',
          comment_start: '<#',
          comment_end: '#>',
        },
      })
    ).toEqual([
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
        declarationStartOffset: 7,
      }),
    ]);
  });

  it('collects fallback set-variable bindings with normalized source paths', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings('{% set local = users[item + 1] %}');

    expect(bindings).toEqual([
      expect.objectContaining({
        kind: 'set-variable',
        name: 'local',
        sourceExpression: 'users[item + 1]',
        sourcePath: 'users[0]',
      }),
    ]);
  });

  it('gracefully handles set nodes when opening statement tags cannot be located', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 1 },
          children: [
            {
              type: 'set',
              name: 'local',
              value: {
                type: 'variable',
                name: 'users',
                path: [],
                start: { line: 10, column: 0 },
                end: { line: 10, column: 5 },
              },
              start: { line: 10, column: 0 },
              end: { line: 10, column: 10 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings('x');

    expect(bindings).toEqual([
      expect.objectContaining({
        kind: 'set-variable',
        name: 'local',
        sourcePath: 'users',
        sourceExpression: 'users',
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      }),
    ]);
  });

  it('falls back to undefined declaration offsets when set statement syntax cannot be parsed', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 20 },
          children: [
            {
              type: 'set',
              name: 'local',
              value: {
                type: 'variable',
                name: 'users',
                path: [],
                start: { line: 1, column: 0 },
                end: { line: 1, column: 5 },
              },
              start: { line: 1, column: 0 },
              end: { line: 1, column: 15 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings('{% set local users %}');

    expect(bindings).toEqual([
      expect.objectContaining({
        kind: 'set-variable',
        name: 'local',
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      }),
    ]);
  });

  it('falls back to undefined set source expression when opening tags cannot be located', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 1 },
          children: [
            {
              type: 'set',
              name: 'local',
              value: {
                type: 'literal',
                valueType: 'number',
                value: 1,
                start: { line: 10, column: 0 },
                end: { line: 10, column: 1 },
              },
              start: { line: 10, column: 0 },
              end: { line: 10, column: 10 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings('x');

    expect(bindings).toEqual([
      expect.objectContaining({
        kind: 'set-variable',
        name: 'local',
        sourcePath: undefined,
        sourceExpression: undefined,
      }),
    ]);
  });

  it('falls back to undefined set source expression when neither source text nor path can be derived', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({
        ast: {
          type: 'template',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 1 },
          children: [
            {
              type: 'set',
              name: 'local',
              value: {
                type: 'literal',
                valueType: 'number',
                value: 1,
                start: { line: 10, column: 0 },
                end: { line: 10, column: 1 },
              },
              start: { line: 10, column: 0 },
              end: { line: 10, column: 10 },
            },
          ],
        },
        errors: [],
      }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings('x');

    expect(bindings).toEqual([
      expect.objectContaining({
        kind: 'set-variable',
        name: 'local',
        sourcePath: undefined,
        sourceExpression: undefined,
      }),
    ]);
  });

  it('ignores stray endfor statements during fallback collection', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% endfor %}')).toEqual([]);
  });

  it('keeps fallback bindings when a later name cannot be located in a key-value loop', () => {
    const originalIndexOf = String.prototype.indexOf;
    const indexOfSpy = vi.spyOn(String.prototype, 'indexOf').mockImplementation(function (
      searchString: string,
      position?: number
    ): number {
      if (
        this.toString().includes('for key, value in users') &&
        searchString === 'value' &&
        typeof position === 'number'
      ) {
        return -1;
      }

      return originalIndexOf.call(this.toString(), searchString, position);
    });

    let bindings: ReturnType<typeof extractTemplateBindings>;
    try {
      bindings = extractTemplateBindings('{% for key, value in users %}{{ value }}{% endfor %}');
    } finally {
      indexOfSpy.mockRestore();
    }

    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'key', declarationStartOffset: expect.any(Number) }),
        expect.objectContaining({ name: 'value', declarationStartOffset: expect.any(Number) }),
      ])
    );
  });

  it('keeps fallback key-value bindings when a later name cannot be located during recovery', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({ tokenize: (value: string) => value }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const originalIndexOf = String.prototype.indexOf;
    const indexOfSpy = vi.spyOn(String.prototype, 'indexOf').mockImplementation(function (
      searchString: string,
      position?: number
    ): number {
      if (
        this.toString().includes('for key, value in users') &&
        searchString === 'value' &&
        typeof position === 'number'
      ) {
        return -1;
      }

      return originalIndexOf.call(this.toString(), searchString, position);
    });

    try {
      const module = await import('../../src/semantic/template-scopes.js');
      const bindings = module.extractTemplateBindings(
        '{% for key, value in users %}{{ value }}{% endfor %}'
      );

      expect(bindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'key', declarationStartOffset: expect.any(Number) }),
          expect.objectContaining({ name: 'value', declarationStartOffset: expect.any(Number) }),
        ])
      );
    } finally {
      indexOfSpy.mockRestore();
    }
  });

  it('collects fallback bindings when parsing recovers a matched for/endfor pair', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% for item in users %}{% endfor %}')).toEqual([
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
      }),
    ]);
  });

  it('parses trim-marked fallback for statements with key-value aliases', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings(
      '{%- for key, value in users[activeIndex + 1] | reverse -%}{%- endfor -%}'
    );

    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'key', sourcePath: 'users[0]' }),
        expect.objectContaining({ name: 'value', sourcePath: 'users[0]' }),
      ])
    );
  });

  it('parses trim-marked fallback set statements with source expression capture', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings('{%- set profile = users[item + 1] -%}');

    expect(bindings).toEqual([
      expect.objectContaining({
        kind: 'set-variable',
        name: 'profile',
        sourcePath: 'users[0]',
        sourceExpression: 'users[item + 1]',
      }),
    ]);
  });

  it('skips malformed fallback for-headers with missing iterator identifiers', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({ tokenize: (value: string) => value }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{%- for in users -%}{%- endfor -%}')).toEqual([]);
  });

  it('skips malformed fallback for-headers with invalid in-keyword boundaries', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({ tokenize: (value: string) => value }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{% for item inx users %}{% endfor %}')).toEqual([]);
  });

  it('collects unclosed fallback for-bindings through template end', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({ tokenize: (value: string) => value }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const template = '{%- for item in users -%}{{ item }}';
    const bindings = module.extractTemplateBindings(template);

    expect(bindings).toEqual([
      expect.objectContaining({
        name: 'item',
        sourcePath: 'users',
        scopeEndOffset: template.length,
      }),
    ]);
  });

  it('skips malformed fallback set statements without assignment expressions', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({ tokenize: (value: string) => value }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateBindings('{%- set profile users -%}')).toEqual([]);
  });

  it('sorts recovered fallback bindings by scope start offset', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: (value: string) => value,
    }));
    vi.doMock('../../src/parser/parser.js', () => ({
      parse: () => ({ ast: null, errors: [new Error('recover me')] }),
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    const bindings = module.extractTemplateBindings(
      '{% for first in groups %}{% endfor %}{% for second in items %}{% endfor %}'
    );

    expect(bindings).toHaveLength(2);
    expect(bindings.map((binding) => binding.name)).toEqual(['first', 'second']);
    expect(bindings[0].scopeStartOffset).toBeLessThanOrEqual(bindings[1].scopeStartOffset);
  });
});
