import { describe, expect, it } from 'vitest';
import type { ErrorNode, LiteralNode, ParenNode, UnaryOpNode } from '../parser/types.js';
import type { RenderContext } from './types.js';
import { evaluateParen } from './evaluators.js';

function createRenderContext(): RenderContext {
  return {
    data: {},
    scopes: [],
    filters: new Map(),
    functions: new Map(),
    errors: [],
    options: {
      throwOnError: false,
      maxDepth: 100,
      debug: false,
    },
  };
}

describe('evaluateParen', () => {
  it('evaluates nested expressions through the shared expression dispatcher', () => {
    const context = createRenderContext();
    const nestedLiteral: LiteralNode = {
      type: 'literal',
      valueType: 'number',
      value: 7,
      start: { line: 1, column: 2 },
      end: { line: 1, column: 3 },
    };
    const unaryNode: UnaryOpNode = {
      type: 'unary_op',
      operator: '-',
      operand: nestedLiteral,
      start: { line: 1, column: 1 },
      end: { line: 1, column: 4 },
    };
    const parenNode: ParenNode = {
      type: 'paren',
      value: unaryNode,
      start: { line: 1, column: 0 },
      end: { line: 1, column: 5 },
    };

    expect(evaluateParen(parenNode, context)).toBe(-7);
    expect(context.errors).toHaveLength(0);
  });

  it('propagates nested evaluation errors from the delegated expression', () => {
    const context = createRenderContext();
    const errorNode: ErrorNode = {
      type: 'error',
      message: 'Bad expression',
      recovered: true,
      start: { line: 1, column: 1 },
      end: { line: 1, column: 2 },
    };
    const parenNode: ParenNode = {
      type: 'paren',
      value: errorNode,
      start: { line: 1, column: 0 },
      end: { line: 1, column: 3 },
    };

    expect(evaluateParen(parenNode, context)).toBeUndefined();
    expect(context.errors).toEqual([
      expect.objectContaining({
        type: 'runtime_error',
        message: 'Bad expression',
      }),
    ]);
  });
});
