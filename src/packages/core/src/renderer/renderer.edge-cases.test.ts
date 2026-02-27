import { describe, expect, it } from 'vitest';
import { performance } from 'perf_hooks';
import type { ASTNode, ExpressionNode, TemplateNode } from '../parser/types';
import { parse } from '../parser';
import { tokenize } from '../lexer';
import { Renderer, render } from './renderer';

const POS = { line: 1, column: 0 };

const literal = (value: string | number | boolean | null): ExpressionNode => ({
  type: 'literal',
  valueType: value === null ? 'null' : (typeof value as 'string' | 'number' | 'boolean'),
  value,
  start: POS,
  end: POS,
});

const variable = (name: string): ExpressionNode => ({
  type: 'variable',
  name,
  path: [],
  start: POS,
  end: POS,
});

const binary = (operator: string, left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({
  type: 'binary_op',
  operator,
  left,
  right,
  start: POS,
  end: POS,
});

const unary = (operator: string, operand: ExpressionNode): ExpressionNode => ({
  type: 'unary_op',
  operator,
  operand,
  start: POS,
  end: POS,
});

const filtered = (
  source: ExpressionNode,
  name: string,
  args: ExpressionNode[] = []
): ExpressionNode => ({
  type: 'filter',
  source,
  filters: [{ name, args }],
  start: POS,
  end: POS,
});

const template = (value: ASTNode): TemplateNode => ({
  type: 'template',
  children: [{ type: 'expression_statement', value, start: POS, end: POS }],
  start: POS,
  end: POS,
});

describe('Renderer edge cases', () => {
  describe('binary operations', () => {
    it.each([
      { op: '+', left: 2, right: 3, expected: '5' },
      { op: '+', left: 'a', right: 'b', expected: 'ab' },
      { op: '-', left: 9, right: 4, expected: '5' },
      { op: '-', left: 'a', right: 4, expected: '0' },
      { op: '*', left: 3, right: 4, expected: '12' },
      { op: '*', left: 'x', right: 4, expected: '0' },
      { op: '/', left: 12, right: 3, expected: '4' },
      { op: '/', left: 12, right: 0, expected: '0' },
      { op: '%', left: 13, right: 5, expected: '3' },
      { op: '%', left: 'x', right: 5, expected: '0' },
      { op: '==', left: 1, right: '1', expected: 'true' },
      { op: '!=', left: 1, right: 2, expected: 'true' },
      { op: '===', left: 1, right: 1, expected: 'true' },
      { op: '!==', left: 1, right: '1', expected: 'true' },
      { op: '<', left: 1, right: 2, expected: 'true' },
      { op: '<=', left: 2, right: 2, expected: 'true' },
      { op: '>', left: 3, right: 2, expected: 'true' },
      { op: '>=', left: 2, right: 2, expected: 'true' },
      { op: '&&', left: true, right: false, expected: 'false' },
      { op: '||', left: false, right: true, expected: 'true' },
    ])('evaluates $op operator', ({ op, left, right, expected }) => {
      const ast = template(binary(op, literal(left), literal(right)));
      const result = render(ast, {});
      expect(result.output).toBe(expected);
      expect(result.success).toBe(true);
    });

    it('supports bracket access for arrays/objects', () => {
      expect(render(template(binary('[', literal([10, 20] as never), literal(1))), {}).output).toBe('20');
      expect(
        render(template(binary('[', literal({ x: 'ok' } as never), literal('x' as never))), {}).output
      ).toBe('ok');
    });

    it('returns empty output for unknown operator', () => {
      const ast = template(binary('???', literal(1), literal(2)));
      const result = render(ast, {});
      expect(result.output).toBe('');
      expect(result.success).toBe(true);
    });
  });

  describe('unary operations', () => {
    it('supports logical not', () => {
      expect(render(template(unary('!', literal(false))), {}).output).toBe('true');
    });

    it('supports unary minus and plus for numbers', () => {
      expect(render(template(unary('-', literal(5))), {}).output).toBe('-5');
      expect(render(template(unary('+', literal(5))), {}).output).toBe('5');
    });

    it('returns operand for unknown unary operator', () => {
      expect(render(template(unary('~', literal(5))), {}).output).toBe('5');
    });
  });

  describe('error handling paths', () => {
    it('records filter errors without throwing by default', () => {
      const ast = template(filtered(literal('value'), 'notAFilter'));
      const result = render(ast, {});

      expect(result.output).toBe('value');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe('filter_error');
    });

    it('throws on filter errors when throwOnError is enabled', () => {
      const ast = template(filtered(literal('value'), 'notAFilter'));
      expect(() => render(ast, {}, { throwOnError: true })).toThrow();
    });

    it('records type errors when loop iterable is not an array', () => {
      const loopAst: TemplateNode = {
        type: 'template',
        start: POS,
        end: POS,
        children: [
          {
            type: 'for',
            iterator: 'item',
            iterable: variable('items'),
            body: [{ type: 'text', value: 'x', start: POS, end: POS }],
            start: POS,
            end: POS,
          },
        ],
      };

      const result = render(loopAst, { items: 'not-an-array' });
      expect(result.output).toBe('');
      expect(result.errors[0]?.type).toBe('type_error');
    });

    it('throws for non-array loops when throwOnError is enabled', () => {
      const loopAst: TemplateNode = {
        type: 'template',
        start: POS,
        end: POS,
        children: [
          {
            type: 'for',
            iterator: 'item',
            iterable: variable('items'),
            body: [{ type: 'text', value: 'x', start: POS, end: POS }],
            start: POS,
            end: POS,
          },
        ],
      };

      expect(() => render(loopAst, { items: 'not-an-array' }, { throwOnError: true })).toThrow();
    });

    it('records max-depth errors when loop nesting exceeds configured maxDepth', () => {
      const loopAst: TemplateNode = {
        type: 'template',
        start: POS,
        end: POS,
        children: [
          {
            type: 'for',
            iterator: 'item',
            iterable: variable('items'),
            body: [{ type: 'text', value: 'x', start: POS, end: POS }],
            start: POS,
            end: POS,
          },
        ],
      };

      const renderer = new Renderer({ maxDepth: 0 });
      const result = renderer.render(loopAst, { items: [1] });

      expect(result.output).toBe('');
      expect(result.errors[0]?.type).toBe('runtime_error');
    });

    it('throws max-depth errors when throwOnError is enabled', () => {
      const loopAst: TemplateNode = {
        type: 'template',
        start: POS,
        end: POS,
        children: [
          {
            type: 'for',
            iterator: 'item',
            iterable: variable('items'),
            body: [{ type: 'text', value: 'x', start: POS, end: POS }],
            start: POS,
            end: POS,
          },
        ],
      };

      const renderer = new Renderer({ maxDepth: 0, throwOnError: true });
      expect(() => renderer.render(loopAst, { items: [1] })).toThrow('Maximum nesting depth exceeded');
    });

    it('returns success=false when a runtime exception escapes expression evaluation', () => {
      const ast = template(binary('[', literal(null), literal(0)));
      const result = render(ast, {});

      expect(result.success).toBe(false);
      expect(result.output).toBe('');
      expect(result.errors[0]?.type).toBe('runtime_error');
    });
  });

  describe('fallback nodes', () => {
    it('renders unknown expression types as empty output', () => {
      const ast: TemplateNode = {
        type: 'template',
        start: POS,
        end: POS,
        children: [
          {
            type: 'expression_statement',
            value: { type: 'mystery_expr', start: POS, end: POS } as unknown as ExpressionNode,
            start: POS,
            end: POS,
          },
        ],
      };

      expect(render(ast, {}).output).toBe('');
    });

    it('ignores unknown AST child node types', () => {
      const ast: TemplateNode = {
        type: 'template',
        start: POS,
        end: POS,
        children: [
          { type: 'text', value: 'a', start: POS, end: POS },
          { type: 'mystery_node', start: POS, end: POS } as unknown as ASTNode,
          { type: 'text', value: 'b', start: POS, end: POS },
        ],
      };

      expect(render(ast, {}).output).toBe('ab');
    });
  });

  describe('performance check', () => {
    it('renders 100 loop iterations in under 20ms', () => {
      const templateText = '{% for item in items %}{{ item }}{% endfor %}';
      const parseResult = parse(tokenize(templateText));
      if (!parseResult.ast) throw new Error('Parse failed');

      const items = Array.from({ length: 100 }, (_, i) => i);
      const start = performance.now();
      const result = render(parseResult.ast, { items });
      const durationMs = performance.now() - start;

      expect(result.success).toBe(true);
      expect(result.output.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(20);
    });
  });
});
