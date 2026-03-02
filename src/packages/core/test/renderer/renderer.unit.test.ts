import { describe, expect, it } from 'vitest';
import type {
  BinaryOpNode,
  ErrorNode,
  ExpressionNode,
  FilterNode,
  LiteralNode,
  UnaryOpNode,
  VariableNode,
} from '../../src/parser/types';
import { evaluateError, evaluateExpression } from '../../src/renderer/evaluators';
import type { RenderContext } from '../../src/renderer/types';

const POS = { line: 1, column: 0 };

const createContext = (data: Record<string, unknown> = {}): RenderContext => ({
  data,
  scopes: [],
  filters: new Map(),
  functions: new Map(),
  errors: [],
  options: {
    throwOnError: false,
    maxDepth: 100,
    debug: false,
  },
});

const literal = (value: string | number | boolean | null): LiteralNode => ({
  type: 'literal',
  valueType: value === null ? 'null' : (typeof value as 'string' | 'number' | 'boolean'),
  value,
  start: POS,
  end: POS,
});

const variable = (
  name: string,
  path: Array<{ type: 'property' | 'index'; value: string | ExpressionNode }> = []
): VariableNode => ({
  type: 'variable',
  name,
  path,
  start: POS,
  end: POS,
});

const binary = (operator: string, left: ExpressionNode, right: ExpressionNode): BinaryOpNode => ({
  type: 'binary_op',
  operator,
  left,
  right,
  start: POS,
  end: POS,
});

const unary = (operator: string, operand: ExpressionNode): UnaryOpNode => ({
  type: 'unary_op',
  operator,
  operand,
  start: POS,
  end: POS,
});

const filterExpr = (
  source: ExpressionNode,
  name: string,
  args: ExpressionNode[] = []
): FilterNode => ({
  type: 'filter',
  source,
  filters: [{ name, args }],
  start: POS,
  end: POS,
});

describe('Package: core', () => {
  describe('Domain: rendering', () => {
    describe('Class: Evaluators', () => {
      describe('literal and variable evaluation', () => {
        it('evaluates a literal expression', () => {
          const context = createContext();
          expect(evaluateExpression(literal('hello'), context)).toBe('hello');
          expect(evaluateExpression(literal(42), context)).toBe(42);
        });

        it('resolves variables from the root data object', () => {
          const context = createContext({ user: { profile: { name: 'Ada' } } });
          const expr = variable('user', [
            { type: 'property', value: 'profile' },
            { type: 'property', value: 'name' },
          ]);

          expect(evaluateExpression(expr, context)).toBe('Ada');
        });

        it('prefers innermost scope variables over root data', () => {
          const context = createContext({ value: 'root' });
          context.scopes.push({ value: 'outer' });
          context.scopes.push({ value: 'inner' });

          expect(evaluateExpression(variable('value'), context)).toBe('inner');
        });

        it('supports array length property and index-expression access', () => {
          const context = createContext({ arr: ['a', 'b', 'c'] });

          const lengthExpr = variable('arr', [{ type: 'property', value: 'length' }]);
          expect(evaluateExpression(lengthExpr, context)).toBe(3);

          const indexExpr = variable('arr', [{ type: 'index', value: literal(1) }]);
          expect(evaluateExpression(indexExpr, context)).toBe('b');
        });

        it('returns undefined when an intermediate path value is null', () => {
          const context = createContext({ user: { profile: null } });
          const expr = variable('user', [
            { type: 'property', value: 'profile' },
            { type: 'property', value: 'name' },
          ]);

          expect(evaluateExpression(expr, context)).toBeUndefined();
        });

        it('supports string index conversion for array access', () => {
          const context = createContext({ arr: ['zero', 'one', 'two'] });
          const expr = variable('arr', [{ type: 'index', value: '2' }]);
          expect(evaluateExpression(expr, context)).toBe('two');
        });

        it('reports undefined_variable when lookup fails', () => {
          const context = createContext();
          expect(evaluateExpression(variable('missing'), context)).toBeUndefined();
          expect(context.errors.map((e) => e.type)).toContain('undefined_variable');
        });
      });

      describe('binary operations', () => {
        it.each([
          ['+', literal(2), literal(3), 5],
          ['+', literal('a'), literal('b'), 'ab'],
          ['-', literal(8), literal(3), 5],
          ['*', literal(3), literal(4), 12],
          ['/', literal(12), literal(3), 4],
          ['/', literal(12), literal(0), 0],
          ['%', literal(13), literal(5), 3],
          ['==', literal(1), literal('1'), true],
          ['===', literal(1), literal(1), true],
          ['!==', literal(1), literal('1'), true],
          ['<', literal(1), literal(2), true],
          ['>=', literal(2), literal(2), true],
          ['&&', literal(true), literal(false), false],
          ['||', literal(false), literal(true), true],
        ])('evaluates %s correctly', (op, left, right, expected) => {
          const context = createContext();
          expect(evaluateExpression(binary(op, left, right), context)).toBe(expected);
        });

        it.each([
          ['-', literal('a'), literal(4), 0],
          ['*', literal('x'), literal(4), 0],
          ['%', literal('x'), literal(5), 0],
        ])(
          'returns numeric fallback for %s with non-number operands',
          (op, left, right, expected) => {
            const context = createContext();
            expect(evaluateExpression(binary(op, left, right), context)).toBe(expected);
          }
        );

        it('uses boolean coercion for logical operators', () => {
          const context = createContext();
          expect(evaluateExpression(binary('&&', literal(1), literal(0)), context)).toBe(false);
          expect(evaluateExpression(binary('||', literal(0), literal(1)), context)).toBe(true);
        });

        it('supports bracket access on arrays and objects', () => {
          const context = createContext({ arr: ['x', 'y'], obj: { key: 'ok' } });
          expect(evaluateExpression(binary('[', variable('arr'), literal(1)), context)).toBe('y');
          expect(evaluateExpression(binary('[', variable('obj'), literal('key')), context)).toBe(
            'ok'
          );
        });

        it('returns undefined for unknown operators', () => {
          const context = createContext();
          expect(
            evaluateExpression(binary('???', literal(1), literal(2)), context)
          ).toBeUndefined();
        });
      });

      describe('unary operations', () => {
        it('evaluates logical not', () => {
          const context = createContext();
          expect(evaluateExpression(unary('!', literal(false)), context)).toBe(true);
        });

        it('evaluates numeric unary plus and minus', () => {
          const context = createContext();
          expect(evaluateExpression(unary('-', literal(5)), context)).toBe(-5);
          expect(evaluateExpression(unary('+', literal(5)), context)).toBe(5);
        });

        it('coerces unary plus/minus for non-number operands', () => {
          const context = createContext();
          expect(evaluateExpression(unary('-', literal(true)), context)).toBe(-1);
          expect(evaluateExpression(unary('+', literal(false)), context)).toBe(0);
        });

        it('returns operand for unknown unary operator', () => {
          const context = createContext();
          expect(evaluateExpression(unary('~', literal(5)), context)).toBe(5);
        });
      });

      describe('filter and error handling', () => {
        it('evaluates filter chains with built-in filters', () => {
          const context = createContext({ input: 'hello' });
          const expr = filterExpr(variable('input'), 'upper');
          expect(evaluateExpression(expr, context)).toBe('HELLO');
        });

        it('records filter_error for unknown filters', () => {
          const context = createContext({ input: 'hello' });
          const expr = filterExpr(variable('input'), 'missing_filter');
          const result = evaluateExpression(expr, context);

          expect(result).toBe('hello');
          expect(context.errors.map((e) => e.type)).toContain('filter_error');
        });

        it('throws when throwOnError is enabled and filter is unknown', () => {
          const context = createContext({ input: 'hello' });
          context.options.throwOnError = true;
          const expr = filterExpr(variable('input'), 'missing_filter');
          expect(() => evaluateExpression(expr, context)).toThrow();
        });

        it('evaluates filters with arguments', () => {
          const context = createContext({ input: 'a-b-c' });
          const expr = filterExpr(variable('input'), 'replace', [literal('-'), literal('_')]);
          expect(evaluateExpression(expr, context)).toBe('a_b_c');
        });

        it('records runtime_error for parser error expressions', () => {
          const context = createContext();
          const expr: ErrorNode = {
            type: 'error',
            message: 'Invalid or missing expression type',
            recovered: true,
            start: POS,
            end: POS,
          };

          expect(evaluateError(expr, context)).toBeUndefined();
          expect(context.errors.map((e) => e.type)).toContain('runtime_error');
        });

        it('records runtime_error for invalid expression shape', () => {
          const context = createContext();
          expect(evaluateExpression({} as ExpressionNode, context)).toBeUndefined();
          expect(context.errors.map((e) => e.type)).toContain('runtime_error');
        });
      });
    });
  });
});
