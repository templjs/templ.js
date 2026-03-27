import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BinaryOpNode,
  ErrorNode,
  ExpressionNode,
  FilterNode,
  LiteralNode,
  ParenNode,
  UnaryOpNode,
  VariableNode,
} from '../parser/types.js';
import type { RenderContext } from './types.js';
import { clearFormatterCaches } from './filter-engine.js';
import {
  evaluateBinaryOp,
  evaluateError,
  evaluateExpression,
  evaluateFilter,
  evaluateLiteral,
  evaluateParen,
  evaluateUnaryOp,
  evaluateVariable,
} from './evaluators.js';

function pos(column: number) {
  return { line: 1, column };
}

function literal(value: unknown): LiteralNode {
  const valueType =
    value === null
      ? 'null'
      : typeof value === 'string'
        ? 'string'
        : typeof value === 'number'
          ? 'number'
          : typeof value === 'boolean'
            ? 'boolean'
            : typeof value === 'object'
              ? 'object'
              : null;

  if (valueType === null) {
    throw new TypeError(`Unsupported test literal value: ${String(value)}`);
  }

  return {
    type: 'literal',
    valueType,
    value: value as string | number | boolean | object | null,
    start: pos(0),
    end: pos(1),
  } as unknown as LiteralNode;
}

function variable(
  name: string,
  path: Array<{ type: 'property' | 'index'; value: string | ExpressionNode }> = []
): VariableNode {
  return {
    type: 'variable',
    name,
    path,
    start: pos(0),
    end: pos(1),
  };
}

function binary(operator: string, left: ExpressionNode, right: ExpressionNode): BinaryOpNode {
  return {
    type: 'binary_op',
    operator,
    left,
    right,
    start: pos(0),
    end: pos(1),
  };
}

function unary(operator: string, operand: ExpressionNode): UnaryOpNode {
  return {
    type: 'unary_op',
    operator,
    operand,
    start: pos(0),
    end: pos(1),
  };
}

function filter(source: ExpressionNode, name: string, args: ExpressionNode[] = []): FilterNode {
  return {
    type: 'filter',
    source,
    filters: [{ name, args }],
    start: pos(0),
    end: pos(1),
  };
}

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

describe('evaluateLiteral', () => {
  it('returns literal values as-is', () => {
    const context = createRenderContext();

    expect(evaluateLiteral(literal('x'), context)).toBe('x');
    expect(evaluateLiteral(literal(42), context)).toBe(42);
    expect(evaluateLiteral(literal(true), context)).toBe(true);
    expect(evaluateLiteral(literal(null), context)).toBeNull();
    expect(context.errors).toHaveLength(0);
  });

  it('returns object literals as-is and records no errors', () => {
    const context = createRenderContext();
    const obj = { a: 1, b: 'x' };

    expect(evaluateLiteral(literal(obj), context)).toEqual({ a: 1, b: 'x' });
    expect(context.errors).toHaveLength(0);
  });
});

describe('evaluateVariable', () => {
  it('resolves from nearest scope before root data', () => {
    const context = createRenderContext();
    context.data = { user: { name: 'root' } };
    context.scopes.push({ user: { name: 'inner' } });

    expect(evaluateVariable(variable('user', [{ type: 'property', value: 'name' }]), context)).toBe(
      'inner'
    );
  });

  it('handles array length and index expressions', () => {
    const context = createRenderContext();
    context.data = {
      list: [10, 20, 30],
      keyByIndex: { 1: 'value-1' },
    };

    expect(
      evaluateVariable(variable('list', [{ type: 'property', value: 'length' }]), context)
    ).toBe(3);
    expect(evaluateVariable(variable('list', [{ type: 'index', value: '2' }]), context)).toBe(30);
    expect(
      evaluateVariable(variable('keyByIndex', [{ type: 'index', value: literal(1) }]), context)
    ).toBe('value-1');
  });

  it('supports scope index-expression lookups and null-safe traversal', () => {
    const context = createRenderContext();
    context.scopes.push({
      values: ['a', 'b', 'c'],
      maybe: null,
    });

    expect(
      evaluateVariable(variable('values', [{ type: 'index', value: literal(1) }]), context)
    ).toBe('b');
    expect(
      evaluateVariable(variable('maybe', [{ type: 'property', value: 'name' }]), context)
    ).toBeUndefined();
  });

  it('handles scope property length and string index parsing branches', () => {
    const context = createRenderContext();
    context.scopes.push({
      items: ['first', 'second'],
      obj: { title: 'ok' },
    });

    expect(
      evaluateVariable(variable('items', [{ type: 'property', value: 'length' }]), context)
    ).toBe(2);
    expect(evaluateVariable(variable('items', [{ type: 'index', value: '1' }]), context)).toBe(
      'second'
    );
    expect(evaluateVariable(variable('obj', [{ type: 'property', value: 'title' }]), context)).toBe(
      'ok'
    );
  });

  it('handles root data direct property branch', () => {
    const context = createRenderContext();
    context.data = { account: { id: 'A-1' } };

    expect(
      evaluateVariable(variable('account', [{ type: 'property', value: 'id' }]), context)
    ).toBe('A-1');
  });

  it('returns undefined when root path traversal encounters null/undefined', () => {
    const context = createRenderContext();
    context.data = {
      user: null,
      list: undefined,
    };

    expect(
      evaluateVariable(variable('user', [{ type: 'property', value: 'name' }]), context)
    ).toBeUndefined();
    expect(
      evaluateVariable(variable('list', [{ type: 'index', value: '0' }]), context)
    ).toBeUndefined();
  });

  it('returns undefined and records error for unknown variables', () => {
    const context = createRenderContext();

    expect(evaluateVariable(variable('missing'), context)).toBeUndefined();
    expect(context.errors).toEqual([
      expect.objectContaining({
        type: 'undefined_variable',
        message: 'Undefined variable: missing',
      }),
    ]);
  });
});

describe('evaluateFilter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies context filters with evaluated args', () => {
    const context = createRenderContext();
    context.filters.set(
      'add',
      (value: unknown, increment: unknown) => Number(value) + Number(increment)
    );

    const expr = filter(literal(5), 'add', [literal(3)]);
    expect(evaluateFilter(expr, context)).toBe(8);
    expect(context.errors).toHaveLength(0);
  });

  it('records error and optionally throws for missing filters', () => {
    const context = createRenderContext();
    const expr = filter(literal('x'), 'notFound');

    expect(evaluateFilter(expr, context)).toBe('x');
    expect(context.errors).toEqual([
      expect.objectContaining({
        type: 'filter_error',
        path: 'filter.notFound',
      }),
    ]);

    const throwingContext = createRenderContext();
    throwingContext.options.throwOnError = true;
    expect(() => evaluateFilter(expr, throwingContext)).toThrow('Filter not found: notFound');
  });

  it('resolves built-in filters when context filters do not provide one', () => {
    const context = createRenderContext();
    const expr = filter(literal('hello'), 'upper');

    expect(evaluateFilter(expr, context)).toBe('HELLO');
  });

  it('formats numbers with locale-aware grouping and precision', () => {
    const context = createRenderContext();
    const expr = filter(literal(12345.6), 'format_number', [
      literal('en-US'),
      literal(2),
      literal(2),
    ]);

    expect(evaluateFilter(expr, context)).toBe(
      new Intl.NumberFormat('en-US', {
        useGrouping: true,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(12345.6)
    );
  });

  it('formats currencies with locale-aware symbol placement and separators', () => {
    const context = createRenderContext();
    const expr = filter(literal(1299.5), 'format_currency', [literal('EUR'), literal('de-DE')]);

    expect(evaluateFilter(expr, context)).toBe(
      new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(1299.5)
    );
  });

  it('returns source value for format_currency when currency code is missing', () => {
    const context = createRenderContext();
    const expr = filter(literal(1299.5), 'format_currency', [literal(''), literal('en-US')]);

    expect(evaluateFilter(expr, context)).toBe(1299.5);
  });

  it('uses currency-specific fraction digits in the final format_currency fallback', () => {
    const context = createRenderContext();
    const expr = filter(literal(1234.5), 'format_currency', [literal('JPY'), literal('ja-JP')]);
    class MockNumberFormat {
      constructor(locale?: string, options?: Intl.NumberFormatOptions) {
        if (options?.style === 'currency' && options.currency === 'JPY') {
          if (locale === 'ja-JP' || locale === 'en-US') {
            throw new Error('mock currency formatter unavailable');
          }
        }
      }

      format(value: number): string {
        return `formatted:${value}`;
      }

      resolvedOptions(): Intl.ResolvedNumberFormatOptions {
        return {
          locale: 'en-US',
          numberingSystem: 'latn',
          style: 'currency',
          currency: 'JPY',
          currencyDisplay: 'symbol',
          currencySign: 'standard',
          minimumIntegerDigits: 1,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
          notation: 'standard',
          signDisplay: 'auto',
          roundingIncrement: 1,
          roundingMode: 'halfExpand',
          roundingPriority: 'auto',
          trailingZeroDisplay: 'auto',
        } as Intl.ResolvedNumberFormatOptions;
      }
    }

    clearFormatterCaches();
    vi.stubGlobal('Intl', {
      ...Intl,
      NumberFormat: MockNumberFormat as unknown as typeof Intl.NumberFormat,
    });

    expect(evaluateFilter(expr, context)).toBe('JPY 1235');
    clearFormatterCaches();
  });

  it('returns source value when no filters are present', () => {
    const context = createRenderContext();
    const expr: FilterNode = {
      type: 'filter',
      source: literal('plain'),
      filters: [],
      start: pos(0),
      end: pos(1),
    };

    expect(evaluateFilter(expr, context)).toBe('plain');
  });
});

describe('evaluateBinaryOp', () => {
  it('handles arithmetic, comparison, and logical operators', () => {
    const context = createRenderContext();

    expect(evaluateBinaryOp(binary('+', literal(2), literal(3)), context)).toBe(5);
    expect(evaluateBinaryOp(binary('+', literal('a'), literal(3)), context)).toBe('a3');
    expect(evaluateBinaryOp(binary('*', literal(2), literal(3)), context)).toBe(6);
    expect(evaluateBinaryOp(binary('==', literal(1), literal('1')), context)).toBe(true);
    expect(evaluateBinaryOp(binary('===', literal(1), literal('1')), context)).toBe(false);
    expect(evaluateBinaryOp(binary('&&', literal(true), literal(false)), context)).toBe(false);
    expect(evaluateBinaryOp(binary('&&', literal('x'), literal(3)), context)).toBe(3);
    expect(evaluateBinaryOp(binary('||', literal(false), literal('x')), context)).toBe('x');
    expect(evaluateBinaryOp(binary('||', literal('x'), literal('y')), context)).toBe('x');
    expect(context.errors).toHaveLength(0);
  });

  it('short-circuits logical operators', () => {
    const context = createRenderContext();

    expect(evaluateBinaryOp(binary('||', literal('left'), variable('missing')), context)).toBe(
      'left'
    );
    expect(evaluateBinaryOp(binary('&&', literal(false), variable('missing')), context)).toBe(
      false
    );
    expect(context.errors).toHaveLength(0);
  });

  it('handles edge cases and unknown operators', () => {
    const context = createRenderContext();

    expect(evaluateBinaryOp(binary('/', literal(8), literal(0)), context)).toBe(0);
    expect(evaluateBinaryOp(binary('-', literal('x'), literal(1)), context)).toBe(0);
    expect(evaluateBinaryOp(binary('[', literal({ a: 1 }), literal('a')), context)).toBe(1);
    expect(evaluateBinaryOp(binary('??', literal(1), literal(2)), context)).toBeUndefined();
  });

  it('covers remaining arithmetic and comparison operators', () => {
    const context = createRenderContext();

    expect(evaluateBinaryOp(binary('-', literal(8), literal(3)), context)).toBe(5);
    expect(evaluateBinaryOp(binary('/', literal(8), literal(2)), context)).toBe(4);
    expect(evaluateBinaryOp(binary('%', literal(7), literal(3)), context)).toBe(1);

    expect(evaluateBinaryOp(binary('!=', literal(1), literal(2)), context)).toBe(true);
    expect(evaluateBinaryOp(binary('!==', literal(1), literal(1)), context)).toBe(false);
    expect(evaluateBinaryOp(binary('<', literal(1), literal(2)), context)).toBe(true);
    expect(evaluateBinaryOp(binary('<=', literal(2), literal(2)), context)).toBe(true);
    expect(evaluateBinaryOp(binary('>', literal(3), literal(2)), context)).toBe(true);
    expect(evaluateBinaryOp(binary('>=', literal(2), literal(2)), context)).toBe(true);
  });

  it('returns zero for modulo when operands are non-numeric', () => {
    const context = createRenderContext();

    expect(evaluateBinaryOp(binary('%', literal('x'), literal(2)), context)).toBe(0);
  });
});

describe('evaluateUnaryOp', () => {
  it('evaluates unary operators and falls back for unknown operators', () => {
    const context = createRenderContext();

    expect(evaluateUnaryOp(unary('!', literal(0)), context)).toBe(true);
    expect(evaluateUnaryOp(unary('-', literal('7')), context)).toBe(-7);
    expect(evaluateUnaryOp(unary('+', literal('7')), context)).toBe(7);
    expect(evaluateUnaryOp(unary('~', literal(3)), context)).toBe(3);
  });
});

describe('evaluateParen', () => {
  it('evaluates nested expressions through the shared expression dispatcher', () => {
    const context = createRenderContext();
    const parenNode: ParenNode = {
      type: 'paren',
      value: unary('-', literal(7)),
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

describe('evaluateError', () => {
  it('records runtime error and returns undefined', () => {
    const context = createRenderContext();
    const expr: ErrorNode = {
      type: 'error',
      message: 'parse failed',
      recovered: true,
      start: pos(0),
      end: pos(1),
    };

    expect(evaluateError(expr, context)).toBeUndefined();
    expect(context.errors).toEqual([
      expect.objectContaining({ type: 'runtime_error', message: 'parse failed' }),
    ]);
  });

  it('throws when throwOnError is enabled and still records the runtime error', () => {
    const context = createRenderContext();
    context.options.throwOnError = true;

    const expr: ErrorNode = {
      type: 'error',
      message: 'parse failed',
      recovered: true,
      start: pos(0),
      end: pos(1),
    };

    expect(() => evaluateError(expr, context)).toThrow('parse failed');
    expect(context.errors).toEqual([
      expect.objectContaining({ type: 'runtime_error', message: 'parse failed' }),
    ]);
  });
});

describe('evaluateExpression', () => {
  it('dispatches all supported expression node types', () => {
    const context = createRenderContext();
    context.data = { x: 2 };
    context.filters.set('double', (value: unknown) => Number(value) * 2);

    expect(evaluateExpression(literal(3), context)).toBe(3);
    expect(evaluateExpression(variable('x'), context)).toBe(2);
    expect(evaluateExpression(filter(variable('x'), 'double'), context)).toBe(4);
    expect(evaluateExpression(binary('+', literal(1), literal(2)), context)).toBe(3);
    expect(evaluateExpression(unary('-', literal(5)), context)).toBe(-5);
    expect(
      evaluateExpression(
        {
          type: 'paren',
          value: literal(9),
          start: pos(0),
          end: pos(1),
        },
        context
      )
    ).toBe(9);
    expect(
      evaluateExpression(
        {
          type: 'error',
          message: 'boom',
          recovered: true,
          start: pos(0),
          end: pos(1),
        },
        context
      )
    ).toBeUndefined();
  });

  it('handles invalid/unknown expression types safely', () => {
    const context = createRenderContext();

    expect(evaluateExpression({} as ExpressionNode, context)).toBeUndefined();
    expect(context.errors).toEqual([
      expect.objectContaining({
        type: 'runtime_error',
        message: 'Invalid or missing expression type',
      }),
    ]);
    expect(context.errors[0]).not.toHaveProperty('location');

    expect(evaluateExpression({} as ExpressionNode, context)).toBeUndefined();
    expect(context.errors).toHaveLength(2);
    expect(context.errors[1]).toEqual(
      expect.objectContaining({
        type: 'runtime_error',
        message: 'Invalid or missing expression type',
      })
    );
  });

  it('warns when expression type has no registered evaluator', () => {
    const context = createRenderContext();

    const expr = {
      type: 'nonexistent',
      start: pos(0),
      end: pos(1),
    } as unknown as ExpressionNode;

    expect(evaluateExpression(expr, context)).toBeUndefined();
    expect(context.errors).toHaveLength(1);
    expect(context.errors[0]).toEqual(
      expect.objectContaining({
        type: 'runtime_error',
        message: 'Unknown expression type: nonexistent',
        location: {
          start: expr.start,
          end: expr.end,
        },
      })
    );
  });
});
