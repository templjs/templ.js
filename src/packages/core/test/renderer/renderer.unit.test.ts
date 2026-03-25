import { describe, expect, it } from 'vitest';
import type {
  BinaryOpNode,
  ErrorNode,
  ExpressionNode,
  FilterNode,
  LiteralNode,
  UnaryOpNode,
  VariableNode,
} from '../../src/parser/types.js';
import { evaluateError, evaluateExpression } from '../../src/renderer/evaluators.js';
import type { RenderContext } from '../../src/renderer/types.js';

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

describe('Evaluators', () => {
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

    it('supports scope-based array property and computed index access', () => {
      const context = createContext({ idx: 1 });
      context.scopes.push({ arr: ['zero', 'one', 'two'] });

      expect(
        evaluateExpression(variable('arr', [{ type: 'property', value: 'length' }]), context)
      ).toBe(3);
      expect(
        evaluateExpression(variable('arr', [{ type: 'index', value: variable('idx') }]), context)
      ).toBe('one');
    });

    it('supports scope-based string index path resolution', () => {
      const context = createContext();
      context.scopes.push({ arr: ['zero', 'one', 'two'] });

      expect(evaluateExpression(variable('arr', [{ type: 'index', value: '2' }]), context)).toBe(
        'two'
      );
    });

    it('returns undefined for nullish scope intermediates', () => {
      const context = createContext();
      context.scopes.push({ user: { profile: null } });

      expect(
        evaluateExpression(
          variable('user', [
            { type: 'property', value: 'profile' },
            { type: 'property', value: 'name' },
          ]),
          context
        )
      ).toBeUndefined();
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
      ['<=', literal(2), literal(2), true],
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
    ])('returns numeric fallback for %s with non-number operands', (op, left, right, expected) => {
      const context = createContext();
      expect(evaluateExpression(binary(op, left, right), context)).toBe(expected);
    });

    it('returns operand values for logical operators', () => {
      const context = createContext();
      expect(evaluateExpression(binary('&&', literal(1), literal(0)), context)).toBe(0);
      expect(evaluateExpression(binary('||', literal(0), literal(1)), context)).toBe(1);
    });

    it('returns non-boolean operands from logical short-circuit operators', () => {
      const ctx = createContext({ obj: { key: 'value' } });

      // && — falsy left: returns left without evaluating right
      expect(evaluateExpression(binary('&&', literal(''), literal('hello')), ctx)).toBe('');
      expect(evaluateExpression(binary('&&', literal(null), literal('x')), ctx)).toBeNull();

      // && — truthy left: returns right
      expect(evaluateExpression(binary('&&', literal('hello'), literal('')), ctx)).toBe('');
      expect(evaluateExpression(binary('&&', variable('obj'), literal('right')), ctx)).toBe(
        'right'
      );

      // || — falsy left: returns right
      expect(evaluateExpression(binary('||', literal(''), literal('hello')), ctx)).toBe('hello');
      expect(evaluateExpression(binary('||', literal(null), literal('fallback')), ctx)).toBe(
        'fallback'
      );

      // || — truthy left: returns left (the original object, not a boolean)
      expect(evaluateExpression(binary('||', variable('obj'), literal('unused')), ctx)).toEqual({
        key: 'value',
      });
      expect(evaluateExpression(binary('||', literal('hello'), literal('')), ctx)).toBe('hello');
    });

    it('supports bracket access on arrays and objects', () => {
      const context = createContext({ arr: ['x', 'y'], obj: { key: 'ok' } });
      expect(evaluateExpression(binary('[', variable('arr'), literal(1)), context)).toBe('y');
      expect(evaluateExpression(binary('[', variable('obj'), literal('key')), context)).toBe('ok');
    });

    it('returns undefined for unknown operators', () => {
      const context = createContext();
      expect(evaluateExpression(binary('???', literal(1), literal(2)), context)).toBeUndefined();
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

    it('evaluates filters when args are omitted in the AST payload', () => {
      const context = createContext({ input: 'hello' });
      const expr: FilterNode = {
        type: 'filter',
        source: variable('input'),
        filters: [{ name: 'upper' } as unknown as { name: string; args: ExpressionNode[] }],
        start: POS,
        end: POS,
      };

      expect(evaluateExpression(expr, context)).toBe('HELLO');
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

    it('handles variable with null prototype chain', () => {
      const context = createContext({ obj: Object.create(null) });
      const expr = variable('obj', [{ type: 'property', value: 'missing' }]);
      const result = evaluateExpression(expr, context);
      expect(result).toBeUndefined();
    });

    it('handles variable path with undefined intermediate value', () => {
      const context = createContext({ a: { b: undefined } });
      const expr = variable('a', [
        { type: 'property', value: 'b' },
        { type: 'property', value: 'c' },
      ]);
      const result = evaluateExpression(expr, context);
      expect(result).toBeUndefined();
    });

    it('handles variable path with null intermediate value', () => {
      const context = createContext({ a: { b: null } });
      const expr = variable('a', [
        { type: 'property', value: 'b' },
        { type: 'property', value: 'c' },
      ]);
      const result = evaluateExpression(expr, context);
      expect(result).toBeUndefined();
    });

    it('handles array length property access', () => {
      const context = createContext({ arr: [1, 2, 3] });
      const expr = variable('arr', [{ type: 'property', value: 'length' }]);
      expect(evaluateExpression(expr, context)).toBe(3);
    });

    it('handles array index access by computed expression', () => {
      const context = createContext({ arr: ['a', 'b', 'c'], idx: 1 });
      const expr = variable('arr', [{ type: 'index', value: variable('idx') }]);
      expect(evaluateExpression(expr, context)).toBe('b');
    });

    it('handles object bracket notation with string key', () => {
      const context = createContext({ obj: { key: 'value' } });
      const expr = variable('obj', [{ type: 'index', value: literal('key') }]);
      expect(evaluateExpression(expr, context)).toBe('value');
    });

    it('handles undefined variable error recording', () => {
      const context = createContext();
      evaluateExpression(variable('undefined_var'), context);
      expect(context.errors.length).toBeGreaterThan(0);
      expect(context.errors[0].type).toBe('undefined_variable');
    });

    it('handles filter on undefined value', () => {
      const context = createContext();
      const expr = filterExpr(variable('missing'), 'upper');
      evaluateExpression(expr, context);
      expect(context.errors.length).toBeGreaterThan(0);
    });

    it('handles chain of filters', () => {
      const context = createContext({ text: 'hello world' });
      const expr: FilterNode = {
        type: 'filter',
        source: variable('text'),
        filters: [
          { name: 'upper', args: [] },
          { name: 'replace', args: [literal(' '), literal('_')] },
        ],
        start: POS,
        end: POS,
      };
      const result = evaluateExpression(expr, context);
      expect(result).toBe('HELLO_WORLD');
    });

    it('handles error node with recovered flag true', () => {
      const context = createContext();
      const expr: ErrorNode = {
        type: 'error',
        message: 'Recovered error',
        recovered: true,
        start: POS,
        end: POS,
      };
      evaluateError(expr, context);
      expect(context.errors.length).toBeGreaterThan(0);
    });

    it('handles error node with recovered flag false', () => {
      const context = createContext();
      const expr: ErrorNode = {
        type: 'error',
        message: 'Unrecovered error',
        recovered: false,
        start: POS,
        end: POS,
      };
      evaluateError(expr, context);
      expect(context.errors.length).toBeGreaterThan(0);
    });

    it('uses default runtime error messages for empty parser error messages', () => {
      const context = createContext();
      const expr: ErrorNode = {
        type: 'error',
        message: '',
        recovered: true,
        start: POS,
        end: POS,
      };

      evaluateError(expr, context);
      expect(context.errors[0]?.message).toBe('Invalid or missing expression type');
    });

    it('handles complex nested variable paths', () => {
      const context = createContext({
        user: { profile: { address: { city: 'NYC' } } },
      });
      const expr = variable('user', [
        { type: 'property', value: 'profile' },
        { type: 'property', value: 'address' },
        { type: 'property', value: 'city' },
      ]);
      expect(evaluateExpression(expr, context)).toBe('NYC');
    });

    it('handles scope variable resolution priority', () => {
      const context = createContext({ x: 'global' });
      context.scopes.push({ x: 'scoped' });
      const expr = variable('x');
      expect(evaluateExpression(expr, context)).toBe('scoped');
    });

    it('handles multiple scopes with inner scope priority', () => {
      const context = createContext({ x: 'global' });
      context.scopes.push({ x: 'outer' });
      context.scopes.push({ x: 'inner' });
      expect(evaluateExpression(variable('x'), context)).toBe('inner');
    });

    it('handles variable not in any scope or data', () => {
      const context = createContext({ a: 1 });
      evaluateExpression(variable('missing'), context);
      expect(context.errors.length).toBeGreaterThan(0);
    });

    it('handles comparison operators', () => {
      const context = createContext();
      expect(evaluateExpression(binary('==', literal(1), literal(1)), context)).toBe(true);
      expect(evaluateExpression(binary('!=', literal(1), literal(2)), context)).toBe(true);
      expect(evaluateExpression(binary('<', literal(1), literal(2)), context)).toBe(true);
      expect(evaluateExpression(binary('>', literal(2), literal(1)), context)).toBe(true);
    });

    it('handles logical operators short circuit evaluation', () => {
      const context = createContext();
      // && should short circuit on false
      expect(evaluateExpression(binary('&&', literal(false), literal(true)), context)).toBe(false);
      // || should short circuit on true
      expect(evaluateExpression(binary('||', literal(true), literal(false)), context)).toBe(true);
    });
  });
});
