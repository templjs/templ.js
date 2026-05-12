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

  it('collects nested references across expression node kinds', () => {
    setExpression({
      type: 'filter',
      source: {
        type: 'function_call',
        object: { type: 'variable', name: 'obj', path: [] },
        args: [{ type: 'variable', name: 'arg', path: [] }],
      },
      filters: [{ name: 'lower', args: [{ type: 'variable', name: 'extra', path: [] }] }],
    });

    const variableRefs = extractExpressionVariableReferences('obj arg extra | lower').map(
      (ref) => ref.path
    );
    const filterRefs = extractExpressionFilterReferences('obj arg extra | lower').map(
      (ref) => ref.name
    );

    expect(variableRefs).toEqual(['obj', 'arg', 'extra']);
    expect(filterRefs).toEqual(['lower']);
  });
});
