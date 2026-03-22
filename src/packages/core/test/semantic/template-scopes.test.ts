import { describe, expect, it, vi } from 'vitest';
import type { LexerOptions, PathSegment } from '../../src/index.js';
import { extractTemplateScopeBindings } from '../../src/index.js';
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
    expect(pathSegmentToString(computedIndex)).toBe('[0]');
  });

  it('extracts loop bindings from standard delimiters', () => {
    const template = '{% for item in users %}{{ item.name }}{% endfor %}';
    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        alias: 'item',
        iterablePath: 'users',
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

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        alias: 'item',
        iterablePath: 'users',
      })
    );
  });

  it('uses opening tag end as scope start when a loop body is empty', () => {
    const template = '{% for item in users %}{% endfor %}';
    const bindings = extractTemplateScopeBindings(template);

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

    const bindings = extractTemplateScopeBindings(template, options);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        alias: 'item',
        iterablePath: 'users',
      })
    );
    expect(bindings[0].declarationStartOffset).toBe(template.indexOf('item in users'));
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

    const bindings = extractTemplateScopeBindings(template, options);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        alias: 'item',
        iterablePath: 'users',
      })
    );
  });

  it('skips loop bindings when the iterable cannot be normalized to a path', () => {
    const template = '{% for item in helper(users) %}{{ item }}{% endfor %}';
    expect(extractTemplateScopeBindings(template)).toEqual([]);
  });

  it('returns an empty list when parsing throws unexpectedly', async () => {
    vi.resetModules();
    vi.doMock('../../src/lexer/lexer.js', () => ({
      tokenize: () => {
        throw new Error('tokenize failed');
      },
    }));

    const module = await import('../../src/semantic/template-scopes.js');
    expect(module.extractTemplateScopeBindings('{% for item in users %}{% endfor %}')).toEqual([]);
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
    expect(module.extractTemplateScopeBindings('{% for item in users %}{% endfor %}')).toEqual([]);
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
    expect(module.extractTemplateScopeBindings('plain')).toEqual([
      {
        alias: 'item',
        iterablePath: 'users',
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
    expect(module.extractTemplateScopeBindings('nonsense %}')).toEqual([
      {
        alias: 'item',
        iterablePath: 'users',
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
    expect(module.extractTemplateScopeBindings('x')).toEqual([
      {
        alias: 'item',
        iterablePath: 'users',
        scopeStartOffset: 0,
        scopeEndOffset: 0,
        declarationStartOffset: undefined,
        declarationEndOffset: undefined,
      },
    ]);
  });

  it('falls back when alias lookup cannot be found in a matched opening tag', () => {
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
    let bindings: ReturnType<typeof extractTemplateScopeBindings>;
    try {
      bindings = extractTemplateScopeBindings(template);
    } finally {
      indexOfSpy.mockRestore();
    }

    expect(bindings).toHaveLength(1);
    expect(bindings[0].declarationStartOffset).toBeUndefined();
    expect(bindings[0].declarationEndOffset).toBeUndefined();
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
      module.extractTemplateScopeBindings('plain text', {
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
        alias: 'item',
        iterablePath: 'users',
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
    expect(module.extractTemplateScopeBindings('plain text')).toEqual([]);
  });
});
