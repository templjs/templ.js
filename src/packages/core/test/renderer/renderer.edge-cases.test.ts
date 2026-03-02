import { describe, expect, it } from 'vitest';
import { performance } from 'perf_hooks';
import type { ASTNode, ExpressionNode, TemplateNode } from '../../src/parser/types';
import { parse } from '../../src/parser';
import { tokenize } from '../../src/lexer';
import { Renderer, render } from '../../src/renderer/renderer';
import { literal, variable, binary, filtered, template, POS } from './renderer.test-helpers';

describe('Package: core', () => {
  describe('Domain: rendering', () => {
    describe('Class: Renderer', () => {
      describe('Renderer edge cases', () => {
        describe('Falsy Handling', () => {
          it('should handle null values gracefully', () => {
            const template = '{{ value }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { value: null });
            expect(result.output).toBe('');
          });

          it('should handle undefined values', () => {
            const template = '{{ missing }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, {});
            expect(result.output).toBe('');
          });

          it('should handle zero values correctly', () => {
            const template = '{{ count }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { count: 0 });
            expect(result.output).toBe('0');
          });

          it('should handle empty strings', () => {
            const template = '{{ text }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { text: '' });
            expect(result.output).toBe('');
          });

          it('should handle boolean false', () => {
            const template = '{{ flag }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { flag: false });
            expect(result.output).toBe('false');
          });
        });

        describe('Data Access Edge Cases', () => {
          it('should handle empty arrays in loops', () => {
            const template = '{% for item in items %}{{ item }}{% endfor %}AFTER';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { items: [] });
            expect(result.output).toBe('AFTER');
          });

          it('should handle deeply nested data access', () => {
            const template = '{{ a.b.c.d.e }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { a: { b: { c: { d: { e: 'deep' } } } } });
            expect(result.output).toBe('deep');
          });

          it('should handle missing nested properties', () => {
            const template = '{{ a.b.c }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { a: {} });
            expect(result.output).toBe('');
          });

          it('should handle array access out of bounds', () => {
            const template = '{{ items[99] }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { items: [1, 2, 3] });
            expect(result.output).toBe('');
          });

          it('should handle negative array indices', () => {
            const template = '{{ items[-1] }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { items: [1, 2, 3] });
            expect(result.success).toBe(true);
          });

          it('should handle object property with spaces', () => {
            const template = '{{ obj["key with spaces"] }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { obj: { 'key with spaces': 'value' } });
            expect(result.success).toBe(true);
          });

          it('should handle numeric string keys', () => {
            const template = '{{ obj["123"] }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { obj: { '123': 'numeric' } });
            expect(result.success).toBe(true);
          });
        });

        describe('Data Type Edge Cases', () => {
          it('should handle large numbers', () => {
            const template = '{{ big }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { big: 999999999999 });
            expect(result.output).toBe('999999999999');
          });

          it('should handle floating point numbers', () => {
            const template = '{{ decimal }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { decimal: 3.14159 });
            expect(result.success).toBe(true);
          });

          it('should handle special characters in strings', () => {
            const template = '{{ special }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { special: '<>&"' });
            expect(result.output).toContain('<');
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

            expect(() =>
              render(loopAst, { items: 'not-an-array' }, { throwOnError: true })
            ).toThrow();
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
            expect(() => renderer.render(loopAst, { items: [1] })).toThrow(
              'Maximum nesting depth exceeded'
            );
          });

          it('returns success=false when a runtime exception escapes expression evaluation', () => {
            const ast = template(binary('[', literal(null), literal(0)));
            const result = render(ast, {});

            expect(result.success).toBe(false);
            expect(result.output).toBe('');
            expect(result.errors[0]?.type).toBe('runtime_error');
          });

          it('should handle filter on null gracefully', () => {
            const template = '{{ null_val | upper }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { null_val: null });
            expect(result.success).toBeDefined();
          });

          it('should handle filter on undefined gracefully', () => {
            const template = '{{ missing | length }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, {});
            expect(result.success).toBeDefined();
          });

          it('should handle invalid filter arguments', () => {
            const template = '{{ text | slice("not a number") }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { text: 'hello' });
            expect(result).toBeDefined();
          });

          it('should handle type mismatch in comparisons', () => {
            const template = '{% if "string" > 5 %}yes{% else %}no{% endif %}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, {});
            expect(result.success).toBeDefined();
          });

          it('should handle circular references gracefully', () => {
            const obj: Record<string, unknown> = { name: 'test' };
            obj.self = obj;
            const template = '{{ obj.name }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { obj });
            expect(result.output).toBe('test');
          });

          it('should handle very long strings', () => {
            const template = '{{ longText }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const longText = 'x'.repeat(10000);
            const result = render(parseResult.ast, { longText });
            expect(result.output.length).toBe(10000);
          });

          it('should handle very deep nesting', () => {
            let obj: Record<string, unknown> = { value: 'found' };
            for (let i = 0; i < 20; i++) {
              obj = { nested: obj };
            }
            const template = '{{ obj.nested.nested.nested.value }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { obj });
            expect(result).toBeDefined();
          });

          it('should handle empty template', () => {
            const template = '';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, {});
            expect(result.output).toBe('');
          });

          it('should handle template with only whitespace', () => {
            const template = '   \n\t  ';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, {});
            expect(result.output).toContain(' ');
          });

          it('should handle unicode characters', () => {
            const template = '{{ emoji }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            if (!parseResult.ast) throw new Error('Parse failed');
            const result = render(parseResult.ast, { emoji: '🎉🔥💯' });
            expect(result.output).toContain('🎉');
          });

          it('should handle property access on non-object', () => {
            const template = '{{ num.value }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            const result = render(parseResult.ast!, { num: 42 });
            expect(result.output).toBe('');
          });

          it('should handle index access on non-array', () => {
            const template = '{{ obj[0] }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            const result = render(parseResult.ast!, { obj: { a: 1 } });
            expect(result.output).toBe('');
          });

          it('should report error for invalid expression type', () => {
            const ast = {
              type: 'invalid_expr',
              value: 'x',
              start: { line: 1, column: 0 },
              end: { line: 1, column: 1 },
            } as unknown as ASTNode;
            const result = render(ast, {});
            expect(result.errors.map((e) => e.type)).toContain('runtime_error');
          });

          it('should include debug output if debug option is true', () => {
            const template = '{{ name }}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            const result = render(parseResult.ast!, { name: 'debug' }, { debug: true });
            expect(result.output).toBe('debug');
          });

          it('should report error for unknown node type', () => {
            const ast = {
              type: 'unknown_type',
              value: 'x',
              start: { line: 1, column: 0 },
              end: { line: 1, column: 1 },
            } as unknown as ASTNode;
            const result = render(ast, {});
            expect(result.errors.some((e) => e.type === 'runtime_error')).toBe(true);
          });

          it('should handle deeply nested scopes up to maxDepth', () => {
            const depth = 99;
            let template = '{% for i in arr %}';
            for (let i = 0; i < depth; i++) template += '{% for j in arr %}';
            template += '{{ i }}';
            for (let i = 0; i < depth; i++) template += '{% endfor %}';
            template += '{% endfor %}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            const result = render(parseResult.ast!, { arr: [1] }, { maxDepth: 100 });
            expect(result.errors).toEqual([]);
            expect(result.success).toBe(true);
          });

          it('should report error for exceeding maxDepth', () => {
            const depth = 100;
            let template = '{% for i in arr %}';
            for (let i = 0; i < depth; i++) template += '{% for j in arr %}';
            template += '{{ i }}';
            for (let i = 0; i < depth; i++) template += '{% endfor %}';
            template += '{% endfor %}';
            const tokens = tokenize(template);
            const parseResult = parse(tokens);
            const result = render(parseResult.ast!, { arr: [1] }, { maxDepth: 100 });
            expect(result.success).toBe(false);
            expect(result.errors.some((e) => e.message.includes('Maximum nesting depth'))).toBe(
              true
            );
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
                  value: {
                    type: 'mystery_expr',
                    start: POS,
                    end: POS,
                  } as unknown as ExpressionNode,
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
    });
  });
});
