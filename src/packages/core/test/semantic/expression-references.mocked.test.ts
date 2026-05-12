import { beforeEach, describe, expect, it, vi } from 'vitest';

const parseMock = vi.fn();
const tokenizeMock = vi.fn();

vi.mock('../../src/lexer/lexer.js', () => ({
  tokenize: tokenizeMock,
}));

vi.mock('../../src/parser/parser.js', () => ({
  parse: parseMock,
}));

const { extractExpressionFilterReferences, extractExpressionVariableReferences } =
  await import('../../src/semantic/expression-references.js');

function setExpression(expression: unknown): void {
  tokenizeMock.mockReturnValue([{ type: 'expression' }]);
  parseMock.mockReturnValue({
    ast: {
      children: [
        {
          type: 'expression_statement',
          value: expression,
        },
      ],
    },
  });
}

describe('expression-references mocked branches', () => {
  beforeEach(() => {
    parseMock.mockReset();
    tokenizeMock.mockReset();
  });

  it('returns empty refs when tokenize throws', () => {
    tokenizeMock.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(extractExpressionVariableReferences('user.name')).toEqual([]);
    expect(extractExpressionFilterReferences('user.name | lower')).toEqual([]);
  });

  it('returns empty refs when parser yields no ast', () => {
    tokenizeMock.mockReturnValue([]);
    parseMock.mockReturnValue({ ast: null });

    expect(extractExpressionVariableReferences('user.name')).toEqual([]);
  });

  it('returns empty refs when ast has no expression statement child', () => {
    tokenizeMock.mockReturnValue([]);
    parseMock.mockReturnValue({
      ast: {
        children: [{ type: 'text', value: 'x' }],
      },
    });

    expect(extractExpressionVariableReferences('user.name')).toEqual([]);
  });

  it('collects nested references across all expression node kinds', () => {
    setExpression({
      type: 'filter',
      source: {
        type: 'function_call',
        object: { type: 'variable', name: 'obj', path: [] },
        args: [
          {
            type: 'binary_op',
            left: {
              type: 'unary_op',
              operand: { type: 'variable', name: 'a', path: [] },
            },
            right: {
              type: 'array',
              elements: [
                {
                  type: 'object',
                  properties: [
                    {
                      key: 'k',
                      value: {
                        type: 'paren',
                        value: {
                          type: 'ternary',
                          condition: { type: 'variable', name: 'cond', path: [] },
                          trueValue: { type: 'variable', name: 'tv', path: [] },
                          falseValue: { type: 'literal', value: 1 },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      filters: [{ name: 'lower', args: [{ type: 'variable', name: 'arg', path: [] }] }],
    });

    const variableRefs = extractExpressionVariableReferences('obj a cond tv arg | lower').map(
      (ref) => ref.path
    );
    const filterRefs = extractExpressionFilterReferences('obj a cond tv arg | lower').map(
      (ref) => ref.name
    );

    expect(variableRefs).toEqual(['obj', 'a', 'cond', 'tv', 'arg']);
    expect(filterRefs).toEqual(['lower']);
  });

  it('supports string, numeric and expression bracket paths', () => {
    setExpression({
      type: 'variable',
      name: 'user',
      path: [
        { type: 'property', value: 'profile' },
        { type: 'index', value: 'full name' },
        { type: 'index', value: { type: 'literal', value: 0 } },
        { type: 'index', value: { type: 'call', callee: 'fn' } },
      ],
    });

    const refs = extractExpressionVariableReferences(
      'user.profile["full name"][0][call:{"type":"call","callee":"fn"}]'
    );

    expect(refs).toEqual([
      {
        path: 'user.profile[full name][0][call:{"type":"call","callee":"fn"}]',
        start: 0,
        end: 'user.profile["full name"][0][call:{"type":"call","callee":"fn"}]'.length,
      },
    ]);
  });

  it('ignores non-boundary path matches and quoted filter tokens', () => {
    setExpression({
      type: 'filter',
      source: { type: 'variable', name: 'user', path: [{ type: 'property', value: 'name' }] },
      filters: [{ name: 'lower', args: [] }],
    });

    const vars = extractExpressionVariableReferences('prefixuser.name user.namex user.name');
    const filters = extractExpressionFilterReferences('"| lower" | lowerX | lower');

    expect(vars).toEqual([
      {
        path: 'user.name',
        start: 'prefixuser.name user.namex '.length,
        end: 'prefixuser.name user.namex user.name'.length,
      },
    ]);
    expect(filters).toEqual([
      {
        name: 'lower',
        start: '"| lower" | lowerX | '.length,
        end: '"| lower" | lowerX | lower'.length,
      },
    ]);
  });

  it('deduplicates identical variable locations', () => {
    setExpression({
      type: 'binary_op',
      left: { type: 'variable', name: 'user', path: [] },
      right: { type: 'variable', name: 'user', path: [] },
    });

    const refs = extractExpressionVariableReferences('user');
    expect(refs).toEqual([{ path: 'user', start: 0, end: 4 }]);
  });

  it('skips references when names are not present in content', () => {
    setExpression({
      type: 'filter',
      source: { type: 'variable', name: 'missing', path: [] },
      filters: [{ name: 'notThere', args: [] }],
    });

    expect(extractExpressionVariableReferences('user.name')).toEqual([]);
    expect(extractExpressionFilterReferences('user.name | lower')).toEqual([]);
  });

  it('handles function calls without object receivers', () => {
    setExpression({
      type: 'function_call',
      object: null,
      args: [{ type: 'variable', name: 'user', path: [] }],
    });

    const refs = extractExpressionVariableReferences('user');
    expect(refs).toEqual([{ path: 'user', start: 0, end: 4 }]);
  });

  it('serializes non-object segment values using string coercion fallback', () => {
    setExpression({
      type: 'variable',
      name: 'user',
      path: [{ type: 'index', value: 123 as unknown as { type: string } }],
    });

    const refs = extractExpressionVariableReferences('user[undefined:123]');
    expect(refs).toEqual([{ path: 'user[undefined:123]', start: 0, end: 19 }]);
  });
});
