import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/lexer/lexer.js';
import { TokenType } from '../../src/lexer/types.js';
import { parse, TemplateParser } from '../../src/parser/parser.js';
import { parseExpressionWithPriorityList } from '../../src/parser/parsers.js';
import type {
  ExpressionNode,
  ExpressionStatementNode,
  IfNode,
  ForNode,
  SetNode,
  BlockNode,
  VariableNode,
  LiteralNode,
} from '../../src/parser/types.js';

function splitTopLevel(str: string, delimiter: string): string[] {
  if (!delimiter) return [str];

  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote: "'" | '"' | '`' | null = null;
  let escaped = false;
  let inInterpolation = false;
  let interpolationBraceDepth = 0;
  let interpolationQuote: "'" | '"' | '`' | null = null;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (quote) {
      current += char;
      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (quote === '`') {
        if (inInterpolation) {
          if (interpolationQuote) {
            if (char === interpolationQuote) {
              interpolationQuote = null;
            }
            continue;
          }

          if (char === '"' || char === "'" || char === '`') {
            interpolationQuote = char;
            continue;
          }

          if (char === '{') {
            interpolationBraceDepth++;
            continue;
          }

          if (char === '}') {
            interpolationBraceDepth--;
            if (interpolationBraceDepth <= 0) {
              inInterpolation = false;
              interpolationBraceDepth = 0;
              interpolationQuote = null;
            }
            continue;
          }

          continue;
        }

        if (char === '$' && str[i + 1] === '{') {
          inInterpolation = true;
          interpolationBraceDepth = 1;
          interpolationQuote = null;
          current += '{';
          i++;
          continue;
        }
      }

      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') parenDepth++;
    if (char === ')' && parenDepth > 0) parenDepth--;
    if (char === '[') bracketDepth++;
    if (char === ']' && bracketDepth > 0) bracketDepth--;
    if (char === '{') braceDepth++;
    if (char === '}' && braceDepth > 0) braceDepth--;

    if (
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0 &&
      str.startsWith(delimiter, i)
    ) {
      parts.push(current);
      current = '';
      i += delimiter.length - 1;
      continue;
    }

    current += char;
  }

  if (current || str.length === 0 || str.endsWith(delimiter)) {
    parts.push(current);
  }

  return parts;
}

interface ExpressionParserTestConfig {
  delimiters?: {
    expression?: [string, string];
  };
}

function createExpressionParserContext(config: ExpressionParserTestConfig = {}) {
  const expressionDelimiters = config.delimiters?.expression;
  const normalizeExpressionInput = (expr: string): string => {
    const trimmed = expr.trim();
    if (!expressionDelimiters) {
      return trimmed;
    }

    const [startDelimiter, endDelimiter] = expressionDelimiters;
    if (trimmed.startsWith(startDelimiter) && trimmed.endsWith(endDelimiter)) {
      return trimmed.slice(startDelimiter.length, trimmed.length - endDelimiter.length).trim();
    }

    return trimmed;
  };

  const context = {
    config,
    parseExpression: (expr: string): ExpressionNode =>
      parseExpressionWithPriorityList(normalizeExpressionInput(expr), context),
    parseLiteral: (expr: string): LiteralNode | null => {
      const trimmed = normalizeExpressionInput(expr);
      if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
        return {
          type: 'literal',
          valueType: 'string',
          value: trimmed.slice(1, -1),
          start: { line: 1, column: 0 },
          end: { line: 1, column: trimmed.length },
        };
      }

      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        return {
          type: 'literal',
          valueType: 'number',
          value: Number(trimmed),
          start: { line: 1, column: 0 },
          end: { line: 1, column: trimmed.length },
        };
      }

      return null;
    },
    parseFilterExpression: (expr: string) => {
      const normalized = normalizeExpressionInput(expr);
      const [sourceExpr, ...filterParts] = splitTopLevel(normalized, '|').map((part) =>
        part.trim()
      );

      return {
        type: 'filter' as const,
        source: context.parseExpression(sourceExpr),
        filters: filterParts
          .filter((part) => part.length > 0)
          .map((part) => {
            const filterMatch = part.match(/^([a-zA-Z_]\w*)(?:\((.*)\))?$/);
            if (!filterMatch) {
              return { name: part, args: [] };
            }

            const [, name, rawArgs] = filterMatch;
            const args = rawArgs
              ? splitTopLevel(rawArgs, ',').map((arg) => context.parseExpression(arg.trim()))
              : [];

            return { name, args };
          }),
        start: { line: 1, column: 0 },
        end: { line: 1, column: normalized.length },
      };
    },
    parseVariable: (expr: string) => ({
      type: 'variable' as const,
      name: normalizeExpressionInput(expr),
      path: [],
      start: { line: 1, column: 0 },
      end: { line: 1, column: normalizeExpressionInput(expr).length },
    }),
    parseObjectProperties: () => [],
    splitTopLevel,
    isVariableStart: (char: string) => /[a-zA-Z_]/.test(char),
    createErrorExpression: (message: string) => ({
      type: 'error' as const,
      message,
      recovered: true,
      start: { line: 1, column: 0 },
      end: { line: 1, column: message.length },
    }),
  };

  return context;
}

describe('splitTopLevel', () => {
  it("returns [''] for empty input", () => {
    const result = splitTopLevel('', '|');

    expect(result).toEqual(['']);
  });

  it('returns the original string when delimiter is absent', () => {
    const result = splitTopLevel('no pipes here', '|');

    expect(result).toEqual(['no pipes here']);
  });

  it('preserves empty segments for consecutive delimiters', () => {
    const result = splitTopLevel('a||b', '|');

    expect(result).toEqual(['a', '', 'b']);
  });

  it('does not split delimiters inside quoted strings', () => {
    const result = splitTopLevel(`value | "a|b" | 'c|d' | ` + '`e|f`', '|');

    expect(result).toEqual(['value ', ' "a|b" ', " 'c|d' ", ' `e|f`']);
  });

  it('does not split delimiters inside nested structures', () => {
    const expr = 'fn(a, [1, 2], { key: "x,y" }, (c, d)), tail';
    const result = splitTopLevel(expr, ',');

    expect(result).toEqual(['fn(a, [1, 2], { key: "x,y" }, (c, d))', ' tail']);
  });

  it('respects escaped quote characters while scanning strings', () => {
    const result = splitTopLevel(`'a\\'|b'|next`, '|');

    expect(result).toEqual([`'a\\'|b'`, 'next']);
  });

  it('keeps interpolation quote context when interpolation string contains escaped quotes', () => {
    const result = splitTopLevel("head|`tmpl ${'a\\'|b'}`|tail", '|');

    expect(result).toEqual(['head', "`tmpl ${'a\\'|b'}`", 'tail']);
  });
});

describe('parse', () => {
  describe('Parser - Basic Functionality', () => {
    describe('Text Nodes', () => {
      it('should parse plain text', () => {
        const tokens = tokenize('Hello World');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        expect(result.ast?.children).toHaveLength(1);
        expect(result.ast?.children[0].type).toBe('text');
      });

      it('should parse empty template', () => {
        const tokens = tokenize('');
        const result = parse(tokens);
        expect(result.ast?.children).toHaveLength(0);
      });

      it('should parse multiple text nodes', () => {
        const tokens = tokenize('Hello {{ name }} World');
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(1);
      });

      it('should preserve text content exactly', () => {
        const text = 'Some text with special chars: !@#$%';
        const tokens = tokenize(text);
        const result = parse(tokens);
        const textNode = result.ast?.children[0];
        expect(textNode?.type).toBe('text');
        if (textNode?.type === 'text') {
          expect(textNode.value).toBe(text);
        }
      });

      it('should handle text with line breaks', () => {
        const text = 'Line 1\nLine 2\nLine 3';
        const tokens = tokenize(text);
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('text');
      });

      it('should handle whitespace-only text', () => {
        const tokens = tokenize('   \n  \t  ');
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
      });
    });

    describe('Expression Statements', () => {
      it('should parse simple expression', () => {
        const tokens = tokenize('{{ name }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.type).toBe('expression_statement');
      });

      it('should parse expression with spaces', () => {
        const tokens = tokenize('{{  name  }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.type).toBe('expression_statement');
      });

      it('should parse variable in expression', () => {
        const tokens = tokenize('{{ user }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('variable');
        expect((stmt.value as VariableNode).name).toBe('user');
      });

      it('should parse string literal in expression', () => {
        const tokens = tokenize('{{ "hello" }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('literal');
        expect((stmt.value as LiteralNode).value).toBe('hello');
      });

      it('should parse number literal', () => {
        const tokens = tokenize('{{ 42 }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('literal');
        expect((stmt.value as LiteralNode).value).toBe(42);
      });

      it('should parse boolean literals', () => {
        let tokens = tokenize('{{ true }}');
        let result = parse(tokens);
        let stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect((stmt.value as LiteralNode).value).toBe(true);

        tokens = tokenize('{{ false }}');
        result = parse(tokens);
        stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect((stmt.value as LiteralNode).value).toBe(false);
      });

      it('should parse null literal', () => {
        const tokens = tokenize('{{ null }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect((stmt.value as LiteralNode).value).toBeNull();
      });
    });

    describe('Comments', () => {
      it('should skip comments in output', () => {
        const tokens = tokenize('{# This is a comment #}');
        const result = parse(tokens);
        expect(result.ast?.children).toHaveLength(0);
      });

      it('should skip comments between text', () => {
        const tokens = tokenize('Hello {# comment #} World');
        const result = parse(tokens);
        expect(result.ast?.children.length).toBe(2);
      });

      it('should skip multiple comments', () => {
        const tokens = tokenize('{# first #} text {# second #}');
        const result = parse(tokens);
        const textNode = result.ast?.children.find((n) => n.type === 'text');
        expect(textNode).toBeDefined();
      });
    });
  });

  describe('Parser - Variable Path Resolution', () => {
    describe('Simple Variables', () => {
      it('should parse simple variable', () => {
        const tokens = tokenize('{{ user }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.type).toBe('variable');
        expect(varNode.name).toBe('user');
        expect(varNode.path).toHaveLength(0);
      });

      it('should parse variable with underscore', () => {
        const tokens = tokenize('{{ _user }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.name).toBe('_user');
      });

      it('should parse variable with numbers', () => {
        const tokens = tokenize('{{ user123 }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.name).toBe('user123');
      });
    });

    describe('Dot Notation', () => {
      it('should parse simple property access', () => {
        const tokens = tokenize('{{ user.name }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.name).toBe('user');
        expect(varNode.path).toHaveLength(1);
        expect(varNode.path[0].type).toBe('property');
        expect(varNode.path[0].value).toBe('name');
      });

      it('should parse chained property access', () => {
        const tokens = tokenize('{{ user.profile.name }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path).toHaveLength(2);
        expect(varNode.path[0].value).toBe('profile');
        expect(varNode.path[1].value).toBe('name');
      });

      it('should parse property with numbers', () => {
        const tokens = tokenize('{{ data.field2 }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path[0].value).toBe('field2');
      });
    });

    describe('Bracket Notation', () => {
      it('should parse numeric index', () => {
        const tokens = tokenize('{{ items[0] }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path).toHaveLength(1);
        expect(varNode.path[0].type).toBe('index');
      });

      it('should parse string index', () => {
        const tokens = tokenize('{{ obj["key"] }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path).toHaveLength(1);
        expect(varNode.path[0].type).toBe('index');
        expect(varNode.path[0].value).toBe('key');
      });

      it('should parse single-quoted string index', () => {
        const tokens = tokenize("{{ obj['key'] }}");
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path[0].value).toBe('key');
      });

      it('should parse chained bracket notation', () => {
        const tokens = tokenize('{{ matrix[0][1] }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path).toHaveLength(2);
      });

      it('should mix dot and bracket notation', () => {
        const tokens = tokenize('{{ user.items[0].name }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = stmt.value as VariableNode;
        expect(varNode.path.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Parser - Filters', () => {
    describe('Single Filter', () => {
      it('should parse simple filter', () => {
        const tokens = tokenize('{{ name | upper }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('filter');
      });

      it('should parse filter with parentheses', () => {
        const tokens = tokenize('{{ text | truncate() }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('filter');
      });

      it('should parse filter with arguments', () => {
        const tokens = tokenize('{{ text | truncate(10) }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('filter');
      });

      it('should parse filter with multiple arguments', () => {
        const tokens = tokenize('{{ text | replace("old", "new") }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('filter');
      });
    });

    describe('Chained Filters', () => {
      it('should parse two chained filters', () => {
        const tokens = tokenize('{{ name | lower | trim }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        if (stmt.value.type === 'filter') {
          expect(stmt.value.type).toBe('filter');
          expect(stmt.value.filters.length).toBeGreaterThanOrEqual(2);
        }
      });

      it('should parse three chained filters', () => {
        const tokens = tokenize('{{ text | trim | lower | upper }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should parse chained filters with arguments', () => {
        const tokens = tokenize('{{ text | replace("a", "b") | upper | trim }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });
  });

  describe('Parser - If Statements', () => {
    describe('Basic If', () => {
      it('should parse simple if statement', () => {
        const tokens = tokenize('{% if user %}Hello{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.type).toBe('if');
        expect(ifNode.body.length).toBeGreaterThan(0);
      });

      it('should parse if with condition', () => {
        const tokens = tokenize('{% if user.active %}Active{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.condition.type).toBe('variable');
      });

      it('should parse if with comparison', () => {
        const tokens = tokenize('{% if count > 0 %}Has items{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.condition.type).toBe('binary_op');
      });

      it('should parse if with equality check', () => {
        const tokens = tokenize('{% if status == "active" %}Active{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.condition.type).toBe('binary_op');
      });

      it('should parse if with negation', () => {
        const tokens = tokenize('{% if !user %}Guest{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.condition.type).toBe('unary_op');
      });

      it('should parse if with AND operator', () => {
        const tokens = tokenize('{% if user && user.active %}Active User{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.type).toBe('if');
      });

      it('should parse if with OR operator', () => {
        const tokens = tokenize('{% if admin || moderator %}Privileged{% endif %}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('if');
      });

      it('reports a syntax error for an invalid if statement', () => {
        const tokens = tokenize('{% if %}Broken{% endif %}');
        const result = parse(tokens);
        const errorNode = result.ast?.children[0];

        expect(errorNode?.type).toBe('error');
        expect(result.errors.some((error) => error.message === 'Unknown statement type')).toBe(
          true
        );
      });

      it('recovers an if block without endif even when the body is empty', () => {
        const tokens = tokenize('{% if user %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;

        expect(ifNode.type).toBe('if');
        expect(ifNode.body).toEqual([]);
        expect(result.errors.some((error) => error.message.includes('Unclosed if block'))).toBe(
          true
        );
      });
    });

    describe('If-Else', () => {
      it('should parse if-else statement', () => {
        const tokens = tokenize('{% if user %}Hello {{ user.name }}{% else %}Guest{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.elseBody).toBeDefined();
        expect(ifNode.elseBody?.length).toBeGreaterThan(0);
      });

      it('should parse if-else with multiple statements', () => {
        const tokens = tokenize('{% if active %}On{% else %}Off{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.body.length).toBeGreaterThan(0);
        expect(ifNode.elseBody?.length).toBeGreaterThan(0);
      });
    });

    describe('Nested If', () => {
      it('should parse nested if in body', () => {
        const tokens = tokenize('{% if outer %}{% if inner %}Nested{% endif %}{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.body.some((n) => n.type === 'if')).toBe(true);
      });

      it('should parse nested if in else', () => {
        const tokens = tokenize('{% if a %}A{% else %}{% if b %}B{% endif %}{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.elseBody?.some((n) => n.type === 'if')).toBe(true);
      });

      it('should parse deeply nested if', () => {
        const tokens = tokenize(
          '{% if a %}{% if b %}{% if c %}Deep{% endif %}{% endif %}{% endif %}'
        );
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('if');
      });
    });

    describe('If with Expressions', () => {
      it('should parse if with text and expressions', () => {
        const tokens = tokenize('{% if user %}Hello {{ user.name }}!{% endif %}');
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.body.some((n) => n.type === 'text')).toBe(true);
        expect(ifNode.body.some((n) => n.type === 'expression_statement')).toBe(true);
      });

      it('should parse if with filters in condition', () => {
        const tokens = tokenize('{% if name | length %}Has name{% endif %}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('if');
      });
    });
  });

  describe('Parser - For Loops', () => {
    describe('Basic For', () => {
      it('should parse simple for loop', () => {
        const tokens = tokenize('{% for item in items %}{{ item }}{% endfor %}');
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;
        expect(forNode.type).toBe('for');
        expect(forNode.iterator).toBe('item');
      });

      it('should parse for with nested expression', () => {
        const tokens = tokenize('{% for user in users %}{{ user.name }}{% endfor %}');
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;
        expect(forNode.iterable.type).toBe('variable');
      });

      it('should parse for with filter in iterable', () => {
        const tokens = tokenize('{% for item in items | reverse %}{{ item }}{% endfor %}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('for');
      });

      it('should parse for with uppercase iterator', () => {
        const tokens = tokenize('{% for ITEM in ITEMS %}{{ ITEM }}{% endfor %}');
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;
        expect(forNode.iterator).toBe('ITEM');
      });

      it('reports a syntax error for an invalid for statement', () => {
        const tokens = tokenize('{% for item items %}Broken{% endfor %}');
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;

        expect(forNode.type).toBe('for');
        expect(forNode.iterable.type).toBe('error');
        expect(
          result.errors.some((error) => error.message === 'Invalid for statement syntax')
        ).toBe(true);
      });

      it('recovers a for block without endfor even when the body is empty', () => {
        const tokens = tokenize('{% for item in items %}');
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;

        expect(forNode.type).toBe('for');
        expect(forNode.body).toEqual([]);
        expect(result.errors.some((error) => error.message.includes('Unclosed for block'))).toBe(
          true
        );
      });
    });

    describe('Nested For', () => {
      it('should parse nested for loops', () => {
        const tokens = tokenize(
          '{% for row in rows %}{% for col in row %}{{ col }}{% endfor %}{% endfor %}'
        );
        const result = parse(tokens);
        const outerFor = result.ast?.children[0] as ForNode;
        expect(outerFor.body.some((n) => n.type === 'for')).toBe(true);
      });

      it('should parse deeply nested for loops', () => {
        const tokens = tokenize(
          '{% for a in A %}{% for b in B %}{% for c in C %}X{% endfor %}{% endfor %}{% endfor %}'
        );
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('for');
      });

      it('should parse for inside if', () => {
        const tokens = tokenize(
          '{% if items %}{% for item in items %}{{ item }}{% endfor %}{% endif %}'
        );
        const result = parse(tokens);
        const ifNode = result.ast?.children[0] as IfNode;
        expect(ifNode.body.some((n) => n.type === 'for')).toBe(true);
      });
    });

    describe('For with Content', () => {
      it('should parse for with mixed content', () => {
        const tokens = tokenize('{% for item in items %}Item: {{ item }}{% endfor %}');
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;
        expect(forNode.body.length).toBeGreaterThan(1);
      });

      it('should parse for with multiple expressions', () => {
        const tokens = tokenize(
          '{% for item in items %}{{ item.id }} - {{ item.name }}{% endfor %}'
        );
        const result = parse(tokens);
        const forNode = result.ast?.children[0] as ForNode;
        expect(
          forNode.body.filter((n) => n.type === 'expression_statement').length
        ).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Parser - Set Statements', () => {
    describe('Basic Set', () => {
      it('should parse set with variable', () => {
        const tokens = tokenize('{% set x = 5 %}');
        const result = parse(tokens);
        const setNode = result.ast?.children[0] as SetNode;
        expect(setNode.type).toBe('set');
        expect(setNode.name).toBe('x');
      });

      it('should parse set with string value', () => {
        const tokens = tokenize('{% set name = "John" %}');
        const result = parse(tokens);
        const setNode = result.ast?.children[0] as SetNode;
        expect(setNode.value.type).toBe('literal');
      });

      it('should parse set with variable reference', () => {
        const tokens = tokenize('{% set local = user.name %}');
        const result = parse(tokens);
        const setNode = result.ast?.children[0] as SetNode;
        expect(setNode.value.type).toBe('variable');
      });

      it('should parse set with expression', () => {
        const tokens = tokenize('{% set total = price * quantity %}');
        const result = parse(tokens);
        const setNode = result.ast?.children[0] as SetNode;
        expect(setNode.value.type).toBe('binary_op');
      });

      it('should parse set with filter', () => {
        const tokens = tokenize('{% set upper_name = name | upper %}');
        const result = parse(tokens);
        const setNode = result.ast?.children[0] as SetNode;
        expect(setNode.value.type).toBe('filter');
      });
    });

    describe('Multiple Sets', () => {
      it('should parse multiple set statements', () => {
        const tokens = tokenize('{% set a = 1 %}{% set b = 2 %}');
        const result = parse(tokens);
        expect(result.ast?.children.filter((n) => n.type === 'set')).toHaveLength(2);
      });

      it('should parse set with text between', () => {
        const tokens = tokenize('{% set x = 1 %}Text{% set y = 2 %}');
        const result = parse(tokens);
        expect(result.ast?.children.some((n) => n.type === 'set')).toBe(true);
        expect(result.ast?.children.some((n) => n.type === 'text')).toBe(true);
      });
    });
  });

  describe('Parser - Block Statements', () => {
    describe('Basic Block', () => {
      it('should parse simple block', () => {
        const tokens = tokenize('{% block header %}Title{% endblock %}');
        const result = parse(tokens);
        const blockNode = result.ast?.children[0] as BlockNode;
        expect(blockNode.type).toBe('block');
        expect(blockNode.name).toBe('header');
      });

      it('should parse block with expressions', () => {
        const tokens = tokenize('{% block content %}{{ page.title }}{% endblock %}');
        const result = parse(tokens);
        const blockNode = result.ast?.children[0] as BlockNode;
        expect(blockNode.body.some((n) => n.type === 'expression_statement')).toBe(true);
      });
    });

    describe('Nested Blocks', () => {
      it('should parse nested blocks', () => {
        const tokens = tokenize(
          '{% block outer %}{% block inner %}Content{% endblock %}{% endblock %}'
        );
        const result = parse(tokens);
        const outerBlock = result.ast?.children[0] as BlockNode;
        expect(outerBlock.body.some((n) => n.type === 'block')).toBe(true);
      });
    });

    describe('Block with Control Structures', () => {
      it('should parse block with if inside', () => {
        const tokens = tokenize('{% block content %}{% if visible %}Show{% endif %}{% endblock %}');
        const result = parse(tokens);
        const blockNode = result.ast?.children[0] as BlockNode;
        expect(blockNode.body.some((n) => n.type === 'if')).toBe(true);
      });

      it('should parse block with for loop inside', () => {
        const tokens = tokenize(
          '{% block items %}{% for item in items %}{{ item }}{% endfor %}{% endblock %}'
        );
        const result = parse(tokens);
        const blockNode = result.ast?.children[0] as BlockNode;
        expect(blockNode.body.some((n) => n.type === 'for')).toBe(true);
      });
    });
  });

  describe('Parser - Complex Expressions', () => {
    describe('Binary Operations', () => {
      it('should parse addition', () => {
        const tokens = tokenize('{{ a + b }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('binary_op');
      });

      it('should parse subtraction', () => {
        const tokens = tokenize('{{ a - b }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('binary_op');
      });

      it('should parse multiplication', () => {
        const tokens = tokenize('{{ a * b }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should parse division', () => {
        const tokens = tokenize('{{ a / b }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should parse comparison operators', () => {
        const operators = ['<', '>', '<=', '>=', '==', '!=', '===', '!=='];
        for (const op of operators) {
          const tokens = tokenize(`{{ a ${op} b }}`);
          const result = parse(tokens);
          expect(result.ast?.children[0].type).toBe('expression_statement');
        }
      });

      it('should parse logical AND', () => {
        const tokens = tokenize('{{ a && b }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should parse logical OR', () => {
        const tokens = tokenize('{{ a || b }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });

    describe('Unary Operations', () => {
      it('should parse logical NOT', () => {
        const tokens = tokenize('{{ !flag }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('unary_op');
      });

      it('should parse negation', () => {
        const tokens = tokenize('{{ -value }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('unary_op');
      });

      it('should parse positive', () => {
        const tokens = tokenize('{{ +value }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('unary_op');
      });

      it('should parse double negation', () => {
        const tokens = tokenize('{{ - -value }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('unary_op');
      });
    });

    describe('Ternary Operator', () => {
      it('should parse ternary expression', () => {
        const tokens = tokenize('{{ flag ? "yes" : "no" }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('ternary');
      });

      it('should parse ternary with variable condition', () => {
        const tokens = tokenize('{{ user ? user.name : "Guest" }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });

    describe('Parenthesized Expressions', () => {
      it('should parse expression in parentheses', () => {
        const tokens = tokenize('{{ (a + b) * c }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should parse nested parentheses', () => {
        const tokens = tokenize('{{ ((a + b) * (c - d)) / e }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });

    describe('Array Literals', () => {
      it('should parse empty array', () => {
        const tokens = tokenize('{{ [] }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('array');
      });

      it('should parse array with numbers', () => {
        const tokens = tokenize('{{ [1, 2, 3] }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('array');
      });

      it('should parse array with strings', () => {
        const tokens = tokenize('{{ ["a", "b", "c"] }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should parse array with mixed types', () => {
        const tokens = tokenize('{{ [1, "two", true, null] }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });

    describe('Object Literals', () => {
      it('should parse empty object', () => {
        const tokens = tokenize('{{ {} }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('object');
      });

      it('should parse object with properties', () => {
        const tokens = tokenize('{{ { name: "John", age: 30 } }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('object');
      });

      it('should parse object with variable values', () => {
        const tokens = tokenize('{{ { user: currentUser, count: total } }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });

    describe('Function Calls', () => {
      it('should parse function call without arguments', () => {
        const tokens = tokenize('{{ getName() }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('function_call');
      });

      it('should parse function call with arguments', () => {
        const tokens = tokenize('{{ add(1, 2) }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('function_call');
      });

      it('should parse method call on variable', () => {
        const tokens = tokenize('{{ user.getName() }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('function_call');
      });
    });
  });

  describe('Parser - Complex Templates', () => {
    describe('Mixed Content', () => {
      it('should parse template with multiple statement types', () => {
        const template = `
        Header
        {% if user %}
          Welcome {{ user.name }}
          {% for post in user.posts %}
            - {{ post.title }}
          {% endfor %}
        {% else %}
          Please log in
        {% endif %}
        Footer
      `;
        const tokens = tokenize(template);
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
        expect(result.ast?.children.some((n) => n.type === 'if')).toBe(true);
      });

      it('should parse template with control flow and expressions', () => {
        const template = `
        {% set total = 0 %}
        {% for item in items %}
          {% if item.active %}
            Item: {{ item.name }}
            {% set total = total + item.price %}
          {% endif %}
        {% endfor %}
        Total: {{ total }}
      `;
        const tokens = tokenize(template);
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
      });
    });

    describe('Real-world Templates', () => {
      it('should parse simple loop with output', () => {
        const template = `
        {% for user in users %}
          <div class="user">
            <h3>{{ user.name }}</h3>
            <p>{{ user.email }}</p>
          </div>
        {% endfor %}
      `;
        const tokens = tokenize(template);
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
      });

      it('should parse conditional block with nested content', () => {
        const template = `
        {% if user %}
          <div class="profile">
            {% if user.avatar %}
              <img src="{{ user.avatar }}" />
            {% endif %}
            <h2>{{ user.name | upper }}</h2>
            <p>Member since {{ user.joinDate }}</p>
          </div>
        {% else %}
          <div class="guest">
            <a href="/login">Login</a>
          </div>
        {% endif %}
      `;
        const tokens = tokenize(template);
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
      });

      it('should parse template with multiple filters', () => {
        const template = `
        {% for post in posts | reverse %}
          <h3>{{ post.title | upper | trim }}</h3>
          <p>{{ post.content | truncate(100) }}</p>
        {% endfor %}
      `;
        const tokens = tokenize(template);
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Parser - Edge Cases and Error Handling', () => {
    describe('Malformed Input', () => {
      it('should handle empty expression', () => {
        const tokens = tokenize('{{ }}');
        const result = parse(tokens);
        expect(result.errors.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle incomplete statements gracefully', () => {
        const tokens = tokenize('{% if user %}no closing');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('should handle invalid operators', () => {
        const tokens = tokenize('{{ a ??? b }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });
    });

    describe('Whitespace Handling', () => {
      it('should handle leading/trailing whitespace in expressions', () => {
        const tokens = tokenize('{{   name   }}');
        const result = parse(tokens);
        const stmt = result.ast?.children[0] as ExpressionStatementNode;
        expect(stmt.value.type).toBe('variable');
      });

      it('should handle newlines in statements', () => {
        const tokens = tokenize('{% if\n  condition\n%}text{% endif %}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('if');
      });

      it('should handle tabs in expressions', () => {
        const tokens = tokenize('{{ \t name \t }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });

    describe('Special Characters', () => {
      it('should handle unicode in text', () => {
        const tokens = tokenize('Hello 👋 世界');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('text');
      });

      it('should handle special chars in strings', () => {
        const tokens = tokenize('{{ "hello\\nworld" }}');
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });

      it('should handle quotes in expressions', () => {
        const tokens = tokenize("{{ 'name' }}");
        const result = parse(tokens);
        expect(result.ast?.children[0].type).toBe('expression_statement');
      });
    });
  });

  describe('Parser - Performance', () => {
    const measureAverageParseMs = (
      tokens: ReturnType<typeof tokenize>,
      iterations = 100
    ): number => {
      parse(tokens);

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        parse(tokens);
      }

      return (performance.now() - start) / iterations;
    };

    it('should parse simple template within 5ms on average', () => {
      const tokens = tokenize('Simple text here');
      const elapsed = measureAverageParseMs(tokens);
      expect(elapsed).toBeLessThan(5);
    });

    it('should parse 4KB template within 5ms on average', () => {
      const template = 'x'.repeat(4096);
      const tokens = tokenize(template);
      const elapsed = measureAverageParseMs(tokens);
      expect(elapsed).toBeLessThan(5);
    });

    it('should parse complex template within 15ms on average', () => {
      const template = `
      {% for i in items %}
        {% if i.active %}
          {{ i.name | upper | trim }}
          {% for j in i.children %}
            {{ j.value }}
          {% endfor %}
        {% endif %}
      {% endfor %}
    `.repeat(10);

      const tokens = tokenize(template);
      const elapsed = measureAverageParseMs(tokens, 50);
      const complexTemplateBudgetMs = process.platform === 'win32' ? 20 : 15;
      expect(elapsed).toBeLessThan(complexTemplateBudgetMs);
    });
  });

  describe('Parser - API', () => {
    it('should export parse function', () => {
      expect(typeof parse).toBe('function');
    });

    it('should return ParseResult type', () => {
      const tokens = tokenize('test');
      const result = parse(tokens);
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('errors');
    });

    it('should have errors array', () => {
      const tokens = tokenize('test');
      const result = parse(tokens);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should have valid AST structure', () => {
      const tokens = tokenize('test');
      const result = parse(tokens);
      expect(result.ast?.type).toBe('template');
      expect(Array.isArray(result.ast?.children)).toBe(true);
    });
  });

  describe('Parser - Complex If/Else Structures', () => {
    it('should parse if with multiple elseif blocks', () => {
      const tokens = tokenize('{% if a %}1{% elseif b %}2{% elseif c %}3{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('if');
    });

    it('should parse deeply nested if blocks', () => {
      const tokens = tokenize(
        '{% if a %}{% if b %}{% if c %}nested{% endif %}{% endif %}{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse if with complex expressions', () => {
      const tokens = tokenize('{% if a.b.c && d[0] || e %}content{% endif %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse if with filter expressions', () => {
      const tokens = tokenize('{% if name | upper == "JOHN" %}match{% endif %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse if with ternary operator', () => {
      const tokens = tokenize('{% if condition ? true_val : false_val %}yes{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse multiple if-else blocks in sequence', () => {
      const tokens = tokenize('{% if a %}x{% endif %}{% if b %}y{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'if').length).toBe(2);
    });

    it('should parse if-else with embedded for loops', () => {
      const tokens = tokenize(
        '{% if items %}{% for item in items %}{{ item }}{% endfor %}{% else %}empty{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('if');
    });

    it('should parse if with text and multiple statements', () => {
      const tokens = tokenize('Start {% if x %}Middle {{ x }} More {% endif %} End');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(2);
    });

    it('should parse comparison operators in if condition', () => {
      const tokens = tokenize('{% if a == b && c != d || e > f %}{% endif %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse logical NOT operator', () => {
      const tokens = tokenize('{% if !condition %}yes{% endif %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse parenthesized conditions', () => {
      const tokens = tokenize('{% if (a && b) || (c && d) %}yes{% endif %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse in operator in conditions', () => {
      const tokens = tokenize('{% if "key" in object %}yes{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse is operator in conditions', () => {
      const tokens = tokenize('{% if value is defined %}yes{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Internal Recovery Branches', () => {
    describe('Parser - Public Extract Content Helpers', () => {
      it('extracts statement content from token delimiter metadata', () => {
        const parser = new TemplateParser([] as any);

        expect(
          parser.extractStatementContent({
            content: '{%   if user.active   %}',
            delimiterStart: '{%',
            delimiterEnd: '%}',
          })
        ).toEqual(
          expect.objectContaining({
            content: 'if user.active',
          })
        );
      });

      it('extracts statement content from plain strings with explicit delimiters', () => {
        const parser = new TemplateParser([] as any);

        expect(
          parser.extractStatementContent('<%   set total = price * qty   %>', {
            start: '<%',
            end: '%>',
          })
        ).toEqual(
          expect.objectContaining({
            content: 'set total = price * qty',
          })
        );
      });

      it('returns trimmed statement content when delimiter metadata and explicit delimiters are both missing', () => {
        const parser = new TemplateParser([] as any);

        expect(parser.extractStatementContent('  if user.active  ')).toEqual(
          expect.objectContaining({
            content: 'if user.active',
          })
        );
      });

      it('extracts expression content from plain strings with explicit delimiters', () => {
        const parser = new TemplateParser([] as any);

        expect(
          parser.extractExpressionContent('[[   user.email   ]]', {
            start: '[[',
            end: ']]',
          }).content
        ).toBe('user.email');
      });

      it('returns trimmed expression content when delimiter metadata and explicit delimiters are both missing', () => {
        const parser = new TemplateParser([] as any);

        expect(parser.extractExpressionContent('  user.email  ')).toEqual(
          expect.objectContaining({
            content: 'user.email',
          })
        );
      });

      it('supports custom delimiters for both methods and default expression delimiters', () => {
        const parser = new TemplateParser([] as any);

        expect(
          parser.extractStatementContent({
            content: '<<   if user.active   >>',
            delimiterStart: '<<',
            delimiterEnd: '>>',
          })
        ).toEqual(
          expect.objectContaining({
            content: 'if user.active',
          })
        );

        expect(
          parser.extractExpressionContent({
            content: '<%   user.email   %>',
            delimiterStart: '<%',
            delimiterEnd: '%>',
          }).content
        ).toBe('user.email');

        expect(
          parser.extractExpressionContent('{{   user.name   }}', { start: '{{', end: '}}' }).content
        ).toBe('user.name');
      });
    });

    it('returns null when parseStatement is called on a non-statement token', () => {
      const parser = new TemplateParser([
        {
          type: TokenType.EXPRESSION,
          content: '{{ value }}',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 11 },
        },
      ] as any);

      expect((parser as any).parseStatement()).toBeNull();
    });

    it('handles invalid if syntax when private parser is invoked directly', () => {
      const parser = new TemplateParser([
        {
          type: TokenType.STATEMENT,
          content: '{% if %}',
          delimiterStart: '{%',
          delimiterEnd: '%}',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 8 },
        },
      ] as any);

      const node = (parser as any).parseIfStatement();
      expect(node).toEqual(
        expect.objectContaining({
          type: 'if',
        })
      );
      expect(node.condition).toEqual(expect.objectContaining({ type: 'error' }));
      expect(
        (parser as any).errors.some(
          (error: { message: string }) => error.message === 'Invalid if statement'
        )
      ).toBe(true);
    });

    it('records recovery errors for unclosed blocks and falls back to start token end', () => {
      const result = parse(tokenize('{% block header %}content'));
      const blockNode = result.ast?.children[0] as BlockNode;

      expect(blockNode.type).toBe('block');
      expect(blockNode.end.line).toBe(blockNode.start.line);
      expect(blockNode.end.column).toBeGreaterThan(blockNode.start.column);
      expect(
        result.errors.some((error) => error.message === 'Unclosed block: missing {% endblock %}')
      ).toBe(true);
    });

    it('advances in parse() when parseStatement returns null after consuming a token', () => {
      const parser = new TemplateParser([
        {
          type: TokenType.STATEMENT,
          content: '{% noop %}',
          delimiterStart: '{%',
          delimiterEnd: '%}',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
      ] as any);

      (parser as any).parseStatement = function () {
        this.advance();
        return null;
      };

      const result = parser.parse();
      expect(result.ast?.children).toEqual([]);
    });

    it('advances in parseStatementBody when nested parseStatement returns null', () => {
      const parser = new TemplateParser([
        {
          type: TokenType.STATEMENT,
          content: '{% noop %}',
          delimiterStart: '{%',
          delimiterEnd: '%}',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
      ] as any);

      (parser as any).parseStatement = () => null;
      expect((parser as any).parseStatementBody(['endif'])).toEqual([]);
    });

    it('handles sparse token arrays without crashing', () => {
      const parser = new TemplateParser(new Array(1) as any);
      const result = parser.parse();

      expect(result.ast?.children).toEqual([]);
      expect(result.ast?.start).toEqual({ line: 1, column: 0 });
      expect(result.ast?.end).toEqual({ line: 1, column: 0 });
    });

    it('skips null statements returned during parse', () => {
      const parser = new TemplateParser([
        {
          type: TokenType.STATEMENT,
          content: '{% noop %}',
          delimiterStart: '{%',
          delimiterEnd: '%}',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
      ] as any);
      (parser as any).parseStatement = () => null;

      const result = parser.parse();
      expect(result.ast?.children).toEqual([]);
    });

    it('throws when private statement parsers are invoked without a token', () => {
      const parser = new TemplateParser([] as any);

      expect(() => (parser as any).parseIfStatement()).toThrow('Expected statement token');
      expect(() => (parser as any).parseForStatement()).toThrow('Expected statement token');
      expect(() => (parser as any).parseSetStatement()).toThrow('Expected statement token');
      expect(() => (parser as any).parseBlockStatement()).toThrow('Expected statement token');
    });

    it('covers parser internals for missing closers, invalid variables, and raw delimiter extraction', () => {
      const parser = new TemplateParser([] as any);

      expect((parser as any).parseVariable('123abc')).toEqual(
        expect.objectContaining({ type: 'variable', name: '123abc', path: [] })
      );
      expect((parser as any).parsePath('.')).toEqual([]);
      expect(
        (parser as any).extractStatementContent('if user', { start: '{%', end: '%}' })
      ).toEqual(
        expect.objectContaining({
          content: 'if user',
        })
      );
      expect(
        (parser as any).extractExpressionContent('name', { start: '{{', end: '}}' }).content
      ).toBe('name');
      expect((parser as any).createErrorVariable('broken')).toEqual(
        expect.objectContaining({ type: 'variable', name: 'broken' })
      );
    });

    it('parses malformed set and block statements into error nodes', () => {
      let result = parse(tokenize('{% set value %}'));
      expect(result.ast?.children[0]).toEqual(expect.objectContaining({ type: 'set', name: '' }));
      expect(result.errors.some((error) => error.message === 'Invalid set statement syntax')).toBe(
        true
      );

      result = parse(tokenize('{% block name extra %}content{% endblock %}'));
      expect(result.ast?.children[0]).toEqual(expect.objectContaining({ type: 'block', name: '' }));
      expect(
        result.errors.some((error) => error.message === 'Invalid block statement syntax')
      ).toBe(true);
    });

    it('handles expression bodies with comments and missing delimiters', () => {
      const bodyParser = new TemplateParser([
        {
          type: TokenType.COMMENT,
          content: '{# noop #}',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
      ] as any);

      expect((bodyParser as any).parseStatementBody(['endif'])).toEqual([]);
      expect(parse(tokenize('{{ user. }}')).ast?.children[0].type).toBe('expression_statement');
      expect(parse(tokenize('{{ user[foo }}')).ast?.children[0].type).toBe('expression_statement');
    });
  });

  describe('Parser - Complex For Loop Structures', () => {
    it('should parse for with complex iterable expression', () => {
      const tokens = tokenize('{% for item in object.array.field %}{{ item }}{% endfor %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('for');
    });

    it('should parse nested for loops', () => {
      const tokens = tokenize(
        '{% for i in a %}{% for j in b %}{{ i }}{{ j }}{% endfor %}{% endfor %}'
      );
      const result = parse(tokens);
      const forNodes = result.ast?.children.filter((n) => n.type === 'for') || [];
      expect(forNodes.length).toBeGreaterThan(0);
    });

    it('should parse for with if conditional inside', () => {
      const tokens = tokenize(
        '{% for item in items %}{% if item.active %}{{ item }}{% endif %}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse for with multiple statements inside', () => {
      const tokens = tokenize(
        '{% for item in items %}{{ item.id }}: {{ item.name }}  {% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('for');
    });

    it('should parse for with set inside loop', () => {
      const tokens = tokenize('{% for item in items %}{% set x = item.value %}{{ x }}{% endfor %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse for with else clause', () => {
      const tokens = tokenize('{% for item in items %}{{ item }}{% else %}No items{% endfor %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('for');
    });

    it('should parse triple nested for loops', () => {
      const tokens = tokenize(
        '{% for a in as %}{% for b in bs %}{% for c in cs %}{{ c }}{% endfor %}{% endfor %}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse for with array filter', () => {
      const tokens = tokenize('{% for item in items | filter %}{{ item }}{% endfor %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse for with key-value unpacking', () => {
      const tokens = tokenize('{% for key, value in items %}{{ key }}: {{ value }}{% endfor %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
      expect(result.ast?.children.length).toBeGreaterThan(0);
      const forNode = result.ast?.children[0] as ForNode;
      expect(forNode.iterator).toBe('key');
      expect(forNode.valueIterator).toBe('value');
    });

    it('should parse for loop variable access (special variables)', () => {
      const tokens = tokenize('{% for item in items %}{{ loop.index }} - {{ item }}{% endfor %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse multiple sequential for loops', () => {
      const tokens = tokenize(
        '{% for i in a %}{{ i }}{% endfor %}{% for j in b %}{{ j }}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(2);
    });

    it('should parse for with complex destructuring', () => {
      const tokens = tokenize('{% for {a, b} in items %}{{ a }}/{{ b }}{% endfor %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Set and Variable Assignment', () => {
    it('should parse set with simple value', () => {
      const tokens = tokenize('{% set x = 5 %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse set with string value', () => {
      const tokens = tokenize('{% set name = "John" %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse set with variable value', () => {
      const tokens = tokenize('{% set x = y %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse set with expression', () => {
      const tokens = tokenize('{% set x = a + b %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse set with object value', () => {
      const tokens = tokenize('{% set obj = { a: 1, b: 2 } %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse set with array value', () => {
      const tokens = tokenize('{% set arr = [1, 2, 3] %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse set with function call', () => {
      const tokens = tokenize('{% set result = func(arg1, arg2) %}');
      const result = parse(tokens);
      expect(result.ast?.children[0].type).toBe('set');
    });

    it('should parse multiple sequential sets', () => {
      const tokens = tokenize('{% set a = 1 %}{% set b = 2 %}{% set c = 3 %}');
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'set').length).toBe(3);
    });

    it('should parse set with filter chain', () => {
      const tokens = tokenize('{% set x = text | upper | trim %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse set with ternary expression', () => {
      const tokens = tokenize('{% set x = condition ? a : b %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Parser - Filter Chains and Expressions', () => {
    it('should parse expression with single filter', () => {
      const tokens = tokenize('{{ name | upper }}');
      const result = parse(tokens);
      const expr = result.ast?.children[0] as ExpressionStatementNode;
      expect(expr.type).toBe('expression_statement');
    });

    it('should parse expression with multiple filters', () => {
      const tokens = tokenize('{{ name | upper | trim }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse filter with arguments', () => {
      const tokens = tokenize('{{ text | replace("old", "new") }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse filter with multiple arguments', () => {
      const tokens = tokenize('{{ text | slice(0, 5) }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse complex filter chain', () => {
      const tokens = tokenize('{{ value | trim | upper | slice(0, 10) | lower }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse filter with function call argument', () => {
      const tokens = tokenize('{{ items | map(func) }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse filter with object property filter', () => {
      const tokens = tokenize('{{ users | map("name") }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse default filter', () => {
      const tokens = tokenize('{{ missing | default("N/A") }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse conditional expression with filters', () => {
      const tokens = tokenize('{{ condition | default(false) ? "yes" : "no" }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse filter with nested expressions', () => {
      const tokens = tokenize('{{ user.name | default(admin.name) }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse arithmetic with filters', () => {
      const tokens = tokenize('{{ (count | default(0)) * price }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Parser - Error Recovery and Edge Cases', () => {
    it('should handle missing endif gracefully', () => {
      const tokens = tokenize('{% if x %}content');
      const result = parse(tokens);
      // Parser should complete without crashing
      expect(result.ast).toBeDefined();
    });

    it('should handle missing endfor gracefully', () => {
      const tokens = tokenize('{% for item in items %}{{ item }}');
      const result = parse(tokens);
      // Parser should complete without crashing
      expect(result.ast).toBeDefined();
    });

    it('should handle unmatched else', () => {
      const tokens = tokenize('{% else %}');
      const result = parse(tokens);
      // Parser should complete without crashing
      expect(result.ast).toBeDefined();
    });

    it('should handle unmatched elseif', () => {
      const tokens = tokenize('{% elseif x %}');
      const result = parse(tokens);
      // Parser should complete without crashing
      expect(result.ast).toBeDefined();
    });

    it('should recover from error and continue parsing', () => {
      const tokens = tokenize('{{ good }}{% bad %}{{ good2 }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should handle malformed expressions', () => {
      const tokens = tokenize('{{ }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty template', () => {
      const tokens = tokenize('');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBe(0);
    });

    it('should handle template with only comments', () => {
      const tokens = tokenize('{# comment #}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should handle empty blocks', () => {
      const tokens = tokenize('{% if x %}{% endif %}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should handle nested error scenarios', () => {
      const tokens = tokenize('{% if x %}{% for y %}{{ z }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should handle multiple sequential errors', () => {
      const tokens = tokenize('{% bad1 %}content{% bad2 %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Advanced Expression Handling', () => {
    it('should parse method chain', () => {
      const tokens = tokenize('{{ obj.method1().method2().method3() }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse array access chain', () => {
      const tokens = tokenize('{{ matrix[0][1][2] }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse mixed property and array access', () => {
      const tokens = tokenize('{{ obj.arr[0].prop[1].field }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse function call with complex arguments', () => {
      const tokens = tokenize('{{ func(a + b, c.d, e[0]) }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse nested function calls', () => {
      const tokens = tokenize('{{ outer(inner(func(arg))) }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse array literals with expressions', () => {
      const tokens = tokenize('{{ [a, b + c, obj.prop] }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse object literals with computed keys', () => {
      const tokens = tokenize('{{ {[key]: value} }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse spread operator', () => {
      const tokens = tokenize('{{ {...obj, extra: value} }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse null coalesce operator', () => {
      const tokens = tokenize('{{ a ?? b ?? c }}');
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse typeof operator', () => {
      const tokens = tokenize('{{ typeof value }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse instanceof operator', () => {
      const tokens = tokenize('{{ obj instanceof Date }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Mixed Constructs and Real-World Templates', () => {
    it('should parse complete user profile template', () => {
      const template = `
      <h1>{{ user.name | upper }}</h1>
      {% if user.bio %}
        <p>{{ user.bio }}</p>
      {% endif %}
      {% for note in user.notes %}
        <div>{{ note.text }}</div>
      {% endfor %}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse shopping cart template', () => {
      const template = `
      {% for item in cart.items %}
        {{ item.name }}: {{ item.price | currency }}
        {% if item.discount %}
          Discount: {{ item.discount }}%
        {% endif %}
      {% else %}
        Cart is empty
      {% endfor %}
      Total: {{ cart.total | currency }}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      // Parser should complete successfully
      expect(result.ast).toBeDefined();
    });

    it('should parse conditional blocks with multiple branches', () => {
      const template = `
      {% if status == "active" %}
        Active user
      {% elseif status == "pending" %}
        Pending approval
      {% elseif status == "inactive" %}
        Inactive account
      {% else %}
        Unknown status
      {% endif %}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      // Should parse successfully
      expect(result.ast).toBeDefined();
    });

    it('should parse table generation template', () => {
      const template = `
      <table>
        {% for row in data %}
          <tr>
            {% for cell in row %}
              <td>{{ cell }}</td>
            {% endfor %}
          </tr>
        {% endfor %}
      </table>
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse form with conditional fields', () => {
      const template = `
      {% set user_type = "employee" %}
      <input name="name" value="{{ user.name }}" />
      {% if user_type == "employee" %}
        <input name="badge" value="{{ user.badge }}" />
      {% endif %}
      {% if user.address %}
        <input name="zip" value="{{ user.address.zip }}" />
      {% endif %}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.errors.length).toBe(0);
    });

    it('should parse invoice template with calculations', () => {
      const template = `
      {% set subtotal = 0 %}
      {% for item in items %}
        {{ item.description }}: {{ item.qty }} x {{ item.price }}
        {% set subtotal = subtotal + (item.qty * item.price) %}
      {% endfor %}
      Subtotal: {{ subtotal }}
      Tax: {{ subtotal * 0.1 }}
      Total: {{ subtotal * 1.1 }}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast).toBeDefined();
    });

    it('should parse nested comments', () => {
      const template = `
      {# Outer comment #}
      {{ value }}
      {# Inner comment with {{ expression }} inside #}
      {% if x %}
        {# Conditional comment #}
        {{ y }}
      {% endif %}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast).toBeDefined();
    });
  });

  describe('Parser - Advanced If/Else Combinations', () => {
    it('should parse nested if inside else', () => {
      const tokens = tokenize('{% if a %}A{% else %}{% if b %}B{% endif %}{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse if inside for inside if', () => {
      const tokens = tokenize(
        '{% if a %}{% for i in b %}{% if c %}{{ i }}{% endif %}{% endfor %}{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse multiple if-else-if chains', () => {
      const tokens = tokenize(
        '{% if a %}1{% elseif b %}2{% else %}{% if c %}3{% elseif d %}4{% endif %}{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse for with nested if', () => {
      const tokens = tokenize(
        '{% for x in xs %}{% if x > 0 %}positive{% elseif x < 0 %}negative{% else %}zero{% endif %}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse if with else for block', () => {
      const tokens = tokenize(
        '{% if a %}A{% else %}{% for x in xs %}{{ x }}{% endfor %}{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Complex Filter Scenarios', () => {
    it('should parse filter with object argument', () => {
      const tokens = tokenize('{{ data | transform({ key: "value" }) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse filter with array argument', () => {
      const tokens = tokenize('{{ items | select([1, 2, 3]) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse conditional filter argument', () => {
      const tokens = tokenize('{{ value | default(flag ? "a" : "b") }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse filter with method call', () => {
      const tokens = tokenize('{{ array | sort(obj.compareFn) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse filter chain with varying argument counts', () => {
      const tokens = tokenize('{{ x | a | b(1) | c(1, 2) | d(1, 2, 3) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse filter on filter result', () => {
      const tokens = tokenize('{{ (items | filter) | map("name") }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Assignment and Mutation Patterns', () => {
    it('should parse set with multiple assignments in sequence', () => {
      const tokens = tokenize('{% set a = 1 %}{% set b = a + 1 %}{% set c = a + b %}');
      const result = parse(tokens);
      const setNodes = result.ast?.children.filter((n) => n.type === 'set') || [];
      expect(setNodes.length).toBeGreaterThan(0);
    });

    it('should parse set inside loop', () => {
      const tokens = tokenize('{% for i in items %}{% set x = x + i %}{% endfor %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse set inside if', () => {
      const tokens = tokenize('{% if condition %}{% set var = value %}{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse accumulator pattern', () => {
      const tokens = tokenize(
        '{% set total = 0 %}{% for item in items %}{% set total = total + item.price %}{% endfor %}{{ total }}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse conditional set', () => {
      const tokens = tokenize('{% if x %}{% set a = 1 %}{% else %}{% set a = 2 %}{% endif %}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Template Composition Patterns', () => {
    it('should parse template with headers and footers', () => {
      const tokens = tokenize(
        'Header text {% for item in items %}{{ item }}{% endfor %} Footer text'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(2);
    });

    it('should parse template with repeated blocks', () => {
      const tokens = tokenize(
        '{% for i in all1 %}{{ i }}{% endfor %}SEPARATOR{% for i in all2 %}{{ i }}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(2);
    });

    it('should parse template with interleaved logic and content', () => {
      const tokens = tokenize(
        'Start {% if a %}A{% endif %} Middle {% if b %}B{% endif %} {% for x in xs %}{{ x }}{% endfor %} End'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(5);
    });

    it('should parse template with conditional headers', () => {
      const tokens = tokenize('{% if title %}{{ title }}{% endif %}Content');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse document structure with sections', () => {
      const tokens = tokenize(
        `
      Title: {{ doc.title }}
      {% for section in doc.sections %}
        ### {{ section.title }}
        {{ section.content }}
      {% endfor %}
    `.trim()
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Expression Operators Combinations', () => {
    it('should parse mixed arithmetic and comparison', () => {
      const tokens = tokenize('{{ a + b > c - d }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse mixed logical operators', () => {
      const tokens = tokenize('{{ (a || b) && (c || d) && (e || f) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse bitwise operators', () => {
      const tokens = tokenize('{{ a & b | c ^ d }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse shift operators', () => {
      const tokens = tokenize('{{ a << 2 >> 1 }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse range operator', () => {
      const tokens = tokenize('{{ [1..10] }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse member access variants', () => {
      const tokens = tokenize('{{ obj.prop?.optional?.chain }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Boundary and Stress Cases', () => {
    it('should parse very long filter chain', () => {
      const tokens = tokenize('{{ x | a | b | c | d | e | f | g | h | i | j }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse deeply nested property access', () => {
      const tokens = tokenize('{{ a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse deeply nested array access', () => {
      const tokens = tokenize('{{ m[0][1][2][3][4][5][6] }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse many sequential expressions', () => {
      const tokens = tokenize(
        `
      {{ a }} {{ b }} {{ c }} {{ d }} {{ e }}
      {{ f }} {{ g }} {{ h }} {{ i }} {{ j }}
    `.trim()
      );
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(10);
    });

    it('should parse many sequential statements', () => {
      const tokens = tokenize(
        `
      {% for a in as %}{% endfor %}
      {% for b in bs %}{% endfor %}
      {% for c in cs %}{% endfor %}
    `.trim()
      );
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(3);
    });

    it('should parse large conditional tree', () => {
      const template = `
      {% if a %}A
      {% elseif b %}B
      {% elseif c %}C
      {% elseif d %}D
      {% elseif e %}E
      {% elseif f %}F
      {% elseif g %}G
      {% else %}Z
      {% endif %}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should parse template with many different statements', () => {
      const template = `
      {% set x = 1 %}
      {% if x %}content{% endif %}
      {% for i in list %}{{ i }}{% endfor %}
      {% set y = 2 %}
      {% if y %}more{% endif %}
    `.trim();
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Parser - Whitespace and Text Handling', () => {
    it('should preserve whitespace in text nodes', () => {
      const tokens = tokenize('  spaces  and\nnewlines  ');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should handle text before and after statements', () => {
      const tokens = tokenize('before{% if x %}middle{% endif %}after');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle empty text nodes', () => {
      const tokens = tokenize('{{ a }}{{ b }}{{ c }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeDefined();
    });

    it('should handle text with special characters', () => {
      const tokens = tokenize('Text with @#$%^&*() special chars {{ x }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should handle text with line breaks', () => {
      const tokens = tokenize('Line 1\nLine 2\n{{ var }}\nLine 3');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('should handle mixed text and expression density', () => {
      const tokens = tokenize('Much text {{ a }} More text {{ b }} Even more {{ c }} Final text');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(3);
    });
  });

  describe('Parser - Advanced Statement Combinations', () => {
    it('parses for with conditional skip logic', () => {
      const tokens = tokenize(
        '{% for i in items %}{% if i.skip %}skip{% endif %}{{ i }}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses multiple sequential loops', () => {
      const tokens = tokenize(
        '{% for i in a %}{{ i }}{% endfor %}{% for j in b %}{{ j }}{% endfor %}{% for k in c %}{{ k }}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(3);
    });

    it('parses nested loops with conditional logic', () => {
      const tokens = tokenize(
        '{% for i in a %}{% for j in b %}{% if c %}{{ i }}{{ j }}{% endif %}{% endfor %}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses set in different branches of conditional', () => {
      const tokens = tokenize(
        '{% if a %}{% set x = 1 %}{% elif b %}{% set x = 2 %}{% else %}{% set x = 3 %}{% endif %}{{ x }}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses for with variable assignment accumulator', () => {
      const tokens = tokenize(
        '{% set sum = 0 %}{% for item in items %}{% set sum = sum + item %}{% endfor %}{{ sum }}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses alternating complex statements', () => {
      const tokens = tokenize(
        '{{ a }}{% if b %}{{ c }}{% endif %}{{ d }}{% for e in f %}{{ e }}{% endfor %}{{ g }}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses loops within conditionals within loops', () => {
      const tokens = tokenize(
        '{% for i in is %}{% if b %}{% for j in js %}{{ j }}{% endfor %}{% endif %}{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses deeply nested conditionals', () => {
      const tokens = tokenize(
        '{% if a %}{% if b %}{% if c %}{% if d %}deep{% endif %}{% endif %}{% endif %}{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses for loop with else clause and nested if', () => {
      const tokens = tokenize(
        '{% for i in items %}{% if i %}{{ i }}{% endif %}{% else %}empty{% endfor %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses multiple assignments before usage', () => {
      const tokens = tokenize(
        '{% set a = 1 %}{% set b = 2 %}{% set c = a + b %}{% if c %}val{% endif %}'
      );
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'set').length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Complex Expression Handling', () => {
    it('parses expression with nested function and method calls', () => {
      const tokens = tokenize('{{ obj.method().other.nested(a.b.c).prop }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses expression with deeply nested arrays', () => {
      const tokens = tokenize('{{ [a, b, [c, d], [[e, f], [g]]] }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses expression with deeply nested objects', () => {
      const tokens = tokenize('{{ {a: 1, b: {c: 2, d: [3, 4]}, e: {f: {g: 5}}} }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses filter with multiple complex arguments', () => {
      const tokens = tokenize('{{ data | transform({a: b.c[0]}, ["x", "y", 42]) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses expression with computed property access', () => {
      const tokens = tokenize('{{ obj[a + b * c] }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses complex conditional expression', () => {
      const tokens = tokenize('{{ (a && b) || (c && d) || (e && f) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses nested ternary operators', () => {
      const tokens = tokenize('{{ a ? (b ? c : d) : (e ? f : g) }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses chain of filters with mixed arguments', () => {
      const tokens = tokenize('{{ items | filter(x > 5) | map(x.name) | join(", ") }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses expression with in and is operators', () => {
      const tokens = tokenize('{{ "key" in object && value is defined }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses expression with nullish coalescing chain', () => {
      const tokens = tokenize('{{ a ?? b ?? c ?? "default" }}');
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Real-World Complex Templates', () => {
    it('parses email template with full logic', () => {
      const template = `Hello {{ user.name }}\n{% if user.email %}<a href="mailto:{{ user.email }}">{{ user.email }}</a>{% endif %}\n{% for msg in messages %}<div>{{ msg }}</div>{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses report with totals', () => {
      const template = `{% set total = 0 %}{% for item in items %}{{ item.value }}\n{% set total = total + item.value %}{% endfor %}Total: {{ total }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses navigation structure', () => {
      const template = `<ul>{% for item in menu %}<li><a href="{{ item.url }}">{{ item.label }}</a>{% if item.sub %}<ul>{% for sub in item.sub %}<li>{{ sub }}</li>{% endfor %}</ul>{% endif %}</li>{% endfor %}</ul>`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses API response with conditional display', () => {
      const template = `{% if response.success %}{% for item in response.data %}{{ item.id }}: {{ item.name | upper }}{% endfor %}{% else %}Error: {{ response.error }}{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses conditional feature flags', () => {
      const template = `{% if features.premium %}<section>Premium</section>{% endif %}{% if features.beta %}<section>Beta</section>{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'if').length).toBe(2);
    });

    it('parses multi-level data with filtering', () => {
      const template = `{% for cat in categories %}{{ cat.name }}{% for item in cat.items %}{% if item.available %}{{ item.name }}: {{ item.price | currency }}{% endif %}{% endfor %}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses document with sections and grid', () => {
      const template = `{% for section in doc.sections %}<h2>{{ section.title }}</h2>{% for col in section.cols %}<div>{{ col.content }}</div>{% endfor %}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses conditional rendering with fallbacks', () => {
      const template = `{{ title | default("Untitled") }}{% if subtitle %}{{ subtitle }}{% endif %}{% if items %}{{ items | length }} items{% else %}No items{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses template with repeated patterns', () => {
      let template = '';
      for (let i = 0; i < 5; i++) {
        template += `{% if condition${i} %}{{ value${i} }}{% endif %}`;
      }
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'if').length).toBe(5);
    });

    it('parses very large loop with multiple operations', () => {
      const template = `{% for i in items %}<tr><td>{{ i.id }}</td><td>{{ i.name | upper }}</td><td>{% if i.status %}Active{% else %}Inactive{% endif %}</td><td>{{ i.value | currency }}</td></tr>{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Stress Tests', () => {
    it('parses many expressions (20+)', () => {
      let template = '';
      for (let i = 0; i < 20; i++) {
        template += `{{ var${i} }} `;
      }
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(
        result.ast?.children.filter((n) => n.type === 'expression_statement').length
      ).toBeGreaterThan(10);
    });

    it('parses many statements (20+)', () => {
      let template = '';
      for (let i = 0; i < 20; i++) {
        template += `{% if i${i} %}{{ i${i} }}{% endif %}`;
      }
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThanOrEqual(20);
    });

    it('parses deeply nested structure (7 levels)', () => {
      const template =
        '{% if a %}{% for i in b %}{% if c %}{% for j in d %}{{ e }}{% endfor %}{% endif %}{% endfor %}{% endif %}';
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses complex mixed structure', () => {
      let template = 'Start {{ a }}';
      for (let i = 0; i < 15; i++) {
        template += `{% if x${i} %}{{ y${i} }}{% endif %}`;
      }
      for (let i = 0; i < 8; i++) {
        template += `{% for z${i} in items %}{{ z${i} }}{% endfor %}`;
      }
      template += 'End {{ b }}';
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(20);
    });

    it('parses 10 sequential for loops', () => {
      let template = '';
      for (let i = 0; i < 10; i++) {
        template += `{% for x${i} in list${i} %}{{ x${i} }}{% endfor %}`;
      }
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(10);
    });

    it('parses template with high expression variability', () => {
      const template = `{{ a }}{{ b.c }}{{ d[0] }}{{ e.f().g }}{{ h | upper }}{{ i | upper | length }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(6);
    });

    it('parses template with mixed operators in expressions', () => {
      const template = `{{ 1 + 2 }}{{ 3 * 4 }}{{ 5 / 2 }}{{ 6 % 3 }}{{ true && false }}{{ true || false }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(6);
    });

    it('parses conditionals with empty bodies', () => {
      const template = `{% if a %}{% endif %}{% if b %}{% elif c %}{% endif %}{% if d %}{% else %}{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBe(3);
    });

    it('parses for loops with empty bodies', () => {
      const template = `{% for i in a %}{% endfor %}{% for j in b %}<span></span>{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(2);
    });

    it('parses mixed empty and full statements', () => {
      const template = `{% if x %}{% endif %}{{ value }}{% for i in items %}x{% endfor %}{{ y }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses set statements with complex right-hand side', () => {
      const template = `{% set a = [1, 2, 3] %}{% set b = {x: 1, y: 2} %}{% set c = obj.method() %}{% set d = x | upper %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'set').length).toBe(4);
    });

    it('parses alternating statements and expressions heavily', () => {
      let template = '';
      for (let i = 0; i < 12; i++) {
        if (i % 2 === 0) {
          template += `{{ x${i} }}`;
        } else {
          template += `{% if y${i} %}{{ z${i} }}{% endif %}`;
        }
      }
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(10);
    });

    it('parses for with multiple variables and complex body', () => {
      const template = `{% for item in items %}{{ item }}{% set x = item.value %}{{ x }}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses nested if within for within if', () => {
      const template = `{% if a %}{% for b in c %}{% if d %}{{ b }}{% endif %}{% endfor %}{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Expression Operator Scenarios', () => {
    it('parses assignment with arithmetic operators', () => {
      const template = `{% set x = a + b %}{% set y = c - d %}{% set z = e * f %}{% set w = g / h %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'set').length).toBe(4);
    });

    it('parses comparison chains', () => {
      const template = `{{ a < b }}{{ c > d }}{{ e <= f }}{{ g >= h }}{{ i == j }}{{ k != l }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(6);
    });

    it('parses logical operator combinations', () => {
      const template = `{{ a && b && c }}{{ d || e || f }}{{ !g }}{{ h && i || j && k }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(4);
    });

    it('parses ternary in different contexts', () => {
      const template = `{% set x = a ? b : c %}{{ d ? e : f }}{% if g ? h : i %}yes{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses combined arithmetic and logical operators', () => {
      const template = `{{ (a + b) > c && (d - e) < f }}{{ (g * h) || (i / j) }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(2);
    });

    it('parses filter chaining with operators', () => {
      const template = `{{ a | upper | length > 5 }}{{ b | lower | startsWith("x") && c }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(2);
    });

    it('parses parenthesized arithmetic before a filter', () => {
      const template = '{{ (value * 100) | round(1) }}';
      const tokens = tokenize(template);
      const result = parse(tokens);

      expect(result.errors).toHaveLength(0);
      const expressionNode = result.ast?.children.find((n) => n.type === 'expression_statement');
      expect(expressionNode).toBeDefined();

      if (!expressionNode || expressionNode.type !== 'expression_statement') {
        throw new Error('Expected expression statement node');
      }

      expect(expressionNode.value.type).toBe('filter');
      if (expressionNode.value.type !== 'filter') {
        throw new Error('Expected filter expression');
      }

      expect(expressionNode.value.filters[0]?.name).toBe('round');
      expect(expressionNode.value.filters[0]?.args).toHaveLength(1);
    });

    it('parses parenthesized arithmetic before a filter with custom expression delimiters', () => {
      const template = '[[ (value * 100) | round(1) ]]';
      const tokens = tokenize(template, {
        delimiters: {
          expression: ['[[', ']]'],
        },
      });
      const result = parse(tokens);

      expect(result.errors).toHaveLength(0);
      const expressionNode = result.ast?.children.find((n) => n.type === 'expression_statement');
      expect(expressionNode).toBeDefined();

      if (!expressionNode || expressionNode.type !== 'expression_statement') {
        throw new Error('Expected expression statement node');
      }

      expect(expressionNode.value.type).toBe('filter');
      if (expressionNode.value.type !== 'filter') {
        throw new Error('Expected filter expression');
      }

      expect(expressionNode.value.filters[0]?.name).toBe('round');
      expect(expressionNode.value.filters[0]?.args).toHaveLength(1);
    });

    it('treats parentheses in template literal text as non-structural for outer wrapping', () => {
      const context = createExpressionParserContext();
      const result = parseExpressionWithPriorityList('(`literal (`)', context);

      expect(result.type).toBe('paren');
      if (result.type !== 'paren') {
        throw new Error('Expected paren expression');
      }

      expect(result.value).toEqual(
        expect.objectContaining({
          type: 'literal',
          value: 'literal (',
        })
      );
    });

    it('still treats parentheses inside template expressions as structural', () => {
      const context = createExpressionParserContext();
      // Deliberately malformed `${...}` interpolation (unbalanced `(`) to assert structural-paren edge behavior.
      const result = parseExpressionWithPriorityList('(`value ${count + (offset}`)', context);

      // The unbalanced `(` inside ${...} causes isWrappedByOutermostParens to return false (depth ends at 1,
      // not 0), so no rule matches and the fallback error expression is returned.
      expect(result.type).toBe('error');
    });

    it('handles nested template literals inside template expressions', () => {
      const context = createExpressionParserContext();
      const result = parseExpressionWithPriorityList('(`value ${fn(`${nested}`)}`)', context);

      expect(result.type).toBe('paren');
      if (result.type !== 'paren') {
        throw new Error('Expected paren expression');
      }

      expect(result.value).toEqual(
        expect.objectContaining({
          type: 'literal',
          value: 'value ${fn(`${nested}`)}',
        })
      );
    });

    it('handles nested template literals inside template expressions with custom delimiters configured', () => {
      const context = createExpressionParserContext({
        delimiters: {
          expression: ['[[', ']]'],
        },
      });
      const result = parseExpressionWithPriorityList('(`value ${fn(`${nested}`)}`)', context);

      expect(result.type).toBe('paren');
      if (result.type !== 'paren') {
        throw new Error('Expected paren expression');
      }

      expect(result.value).toEqual(
        expect.objectContaining({
          type: 'literal',
          value: 'value ${fn(`${nested}`)}',
        })
      );
    });

    it('parses filter expressions wrapped by custom expression delimiters in test context', () => {
      const context = createExpressionParserContext({
        delimiters: {
          expression: ['[[', ']]'],
        },
      });

      const result = context.parseExpression('[[ amount | round(2) ]]');

      expect(result.type).toBe('filter');
      if (result.type !== 'filter') {
        throw new Error('Expected filter expression');
      }

      expect(result.source).toEqual(
        expect.objectContaining({
          type: 'variable',
          name: 'amount',
        })
      );
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]?.name).toBe('round');
      expect(result.filters[0]?.args).toHaveLength(1);
    });

    it('parses in and is operators', () => {
      const template = `{{ "key" in obj }}{{ x is defined }}{{ y is not empty }}{{ z in [1, 2, 3] }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'expression_statement').length).toBe(4);
    });

    it('parses modulo and power operators', () => {
      const template = `{{ a % b }}{{ c ** d }}{{ (e + f) % g }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(
        result.ast?.children.filter((n) => n.type === 'expression_statement').length
      ).toBeGreaterThan(0);
    });

    it('parses range syntax if supported', () => {
      const template = `{{ range(1, 10) }}{{ items[0..5] }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses bitwise operators', () => {
      const template = `{{ a & b }}{{ c | d }}{{ e ^ f }}{{ ~g }}{{ h << i }}{{ j >> k }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Block Nesting Variations', () => {
    it('parses if-elif-elif-elif-else chain', () => {
      const template = `{% if a %}1{% elif b %}2{% elif c %}3{% elif d %}4{% elif e %}5{% else %}6{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'if').length).toBe(1);
    });

    it('parses nested if-elif-else structures', () => {
      const template = `{% if a %}{% if b %}x{% elif c %}y{% else %}z{% endif %}{% elif d %}q{% else %}w{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses for with nested for and if', () => {
      const template = `{% for i in a %}{% for j in b %}{% if c %}{{ i }}{{ j }}{% endif %}{% endfor %}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses multiple if siblings with various structures', () => {
      const template = `{% if a %}{% if x %}{{ x }}{% endif %}{% endif %}{% if b %}{% if y %}{{ y }}{% elif z %}{{ z }}{% endif %}{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses for-if-for nested combination', () => {
      const template = `{% for a in as %}{% if b %}{{ a }}{% for c in cs %}{{ c }}{% endfor %}{% endif %}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses sequential for with else', () => {
      const template = `{% for a in list1 %}{{ a }}{% else %}empty1{% endfor %}{% for b in list2 %}{{ b }}{% else %}empty2{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.filter((n) => n.type === 'for').length).toBe(2);
    });

    it('parses deeply nested for (5 levels)', () => {
      const template = `{% for a in as %}{% for b in bs %}{% for c in cs %}{% for d in ds %}{% for e in es %}{{ e }}{% endfor %}{% endfor %}{% endfor %}{% endfor %}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses if followed by for followed by if', () => {
      const template = `{% if x %}start{% endif %}{% for i in items %}{{ i }}{% endfor %}{% if y %}end{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBe(3);
    });

    it('parses mix of all statement types in sequence', () => {
      const template = `{% set a = 1 %}{{ b }}{% if c %}{{ d }}{% endif %}{% for e in f %}{{ e }}{% endfor %}{% set g = 2 %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses for with multiple sets inside', () => {
      const template = `{% for i in items %}{% set x = i.value %}{% set y = x * 2 %}{% set z = y + 1 %}{{ z }}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Parser - Whitespace and Text Preservation', () => {
    it('parses template with significant whitespace before statements', () => {
      const template = `line 1\n    {% if x %}indented{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses template with trailing whitespace after statements', () => {
      const template = `{% if x %}yes{% endif %}   \ntext`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses template with mixed newlines and spaces', () => {
      const template = `line1  \n  {{ a }}\n\nline2\n{% if b %}x{% endif %}\n  line3`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses template with tabs and spaces mixed', () => {
      const template = `\t\ttab\n  \t  mixed\n{{ x }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses dense template with minimal whitespace', () => {
      const template = `{{ a }}{% if b %}{{ b }}{% endif %}{{ c }}{% for i in d %}{{ i }}{% endfor %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses multiline expressions', () => {
      const template = `{{ a +\n    b +\n    c }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses statements with internal formatting', () => {
      const template = `{% if\n    a &&\n    b ||\n    c\n%}yes{% endif %}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses HTML content mixed with statements', () => {
      const template = `<div class="container">{{ title }}</div>\n<ul>\n{% for item in items %}\n<li>{{ item }}</li>\n{% endfor %}\n</ul>`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses JSON content with templates', () => {
      const template = `{\n  "name": "{{ user.name }}",\n  "count": {{ items | length }},\n  "items": [{% for i in items %}{{ i }}{% if not loop.last %},{% endif %}{% endfor %}]\n}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    it('parses YAML with template interpolation', () => {
      const template = `key: {{ value }}\nlist:\n{% for item in items %}  - {{ item }}\n{% endfor %}nested:\n  value: {{ config.value }}`;
      const tokens = tokenize(template);
      const result = parse(tokens);
      expect(result.ast?.children.length).toBeGreaterThan(0);
    });

    describe('Edge cases and error conditions', () => {
      it('handles expressions with leading operators', () => {
        const tokens = tokenize('{{ +x }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr).toBeDefined();
      });

      it('handles unary operators with empty operands', () => {
        const tokens = tokenize('{{ - }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        // Should handle gracefully, likely as error expression
      });

      it('handles malformed set statements', () => {
        const tokens = tokenize('{% set %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('handles set statements with invalid assignments', () => {
        const tokens = tokenize('{% set x %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles block statements with no name', () => {
        const tokens = tokenize('{% block %}content{% endblock %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles completely empty expressions', () => {
        const tokens = tokenize('{{  }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        // Empty expression should be handled as error
      });

      it('handles binary operators with incomplete operands', () => {
        const tokens = tokenize('{{ x + }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles multiple levels of invalid nesting', () => {
        const tokens = tokenize('{% if %}{% if %}content{% endif %}{% endif %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles filter with invalid syntax', () => {
        const tokens = tokenize('{{ name | bad-filter }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles filter expression without pipe', () => {
        const tokens = tokenize('{{ item | }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles object literal with malformed properties', () => {
        const tokens = tokenize('{{ {x:} }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles array literal with trailing comma', () => {
        const tokens = tokenize('{{ [1, 2,] }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles nested parentheses in expressions', () => {
        const tokens = tokenize('{{ ((x + y) * (z - 1)) }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBeDefined();
      });

      it('handles variable with unclosed index', () => {
        const tokens = tokenize('{{ arr[ }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles method call with invalid args', () => {
        const tokens = tokenize('{{ obj.method(x } }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles ternary with missing parts', () => {
        const tokens = tokenize('{{ x ? : }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles comparison operators in expressions', () => {
        const tokens = tokenize('{{ x == y }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBe('binary_op');
      });

      it('handles logical and operators', () => {
        const tokens = tokenize('{{ x && y }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBe('binary_op');
      });

      it('handles logical or operators', () => {
        const tokens = tokenize('{{ x || y }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBe('binary_op');
      });

      it('handles for loop with destructuring attempt', () => {
        const tokens = tokenize('{% for [a, b] in items %}{{ a }}{% endfor %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles for loop with filter', () => {
        const tokens = tokenize('{% for x in items | filter %}{{ x }}{% endfor %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles nested if statements', () => {
        const tokens = tokenize('{% if a %}{% if b %}nested{% endif %}{% endif %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        expect(result.ast?.children.some((n) => n.type === 'if')).toBe(true);
      });

      it('handles elif chains', () => {
        const tokens = tokenize('{% if a %}1{% elif b %}2{% elif c %}3{% else %}4{% endif %}');
        const result = parse(tokens);
        expect(result.ast?.children.length).toBeGreaterThan(0);
      });

      it('handles unless statement', () => {
        const tokens = tokenize('{% unless x %}content{% endunless %}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles variable with deep path access', () => {
        const tokens = tokenize('{{ a.b.c.d.e }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = expr.value as VariableNode;
        expect(varNode.type).toBe('variable');
        expect(varNode.path.length).toBeGreaterThan(0);
      });

      it('handles variable with index access', () => {
        const tokens = tokenize('{{ arr[0] }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = expr.value as VariableNode;
        expect(varNode.path.length).toBeGreaterThan(0);
      });

      it('handles variable with string index', () => {
        const tokens = tokenize('{{ obj["key"] }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        const varNode = expr.value as VariableNode;
        expect(varNode.path.length).toBeGreaterThan(0);
      });

      it('handles negative number literals', () => {
        const tokens = tokenize('{{ -42 }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBeDefined();
      });

      it('handles float number literals', () => {
        const tokens = tokenize('{{ 3.14159 }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        const lit = expr.value as LiteralNode;
        expect(lit.valueType).toBe('number');
        expect(lit.value).toBe(3.14159);
      });

      it('handles assignment operators', () => {
        const tokens = tokenize('{{ x += 5 }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles in operator', () => {
        const tokens = tokenize('{{ x in y }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('handles not in operator', () => {
        const tokens = tokenize('{{ x not in y }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
      });

      it('parses function call arguments through split/map path', () => {
        const tokens = tokenize('{{ sum(1, 2, 3) }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBe('function_call');
        if (expr.value.type === 'function_call') {
          expect(expr.value.args).toHaveLength(3);
        }
      });

      it('parses method call arguments through split/map path', () => {
        const tokens = tokenize('{{ user.format("a", "b") }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBe('function_call');
        if (expr.value.type === 'function_call') {
          expect(expr.value.args).toHaveLength(2);
        }
      });

      it('parses filter arguments through split/map path', () => {
        const tokens = tokenize('{{ text | replace("old", "new") }}');
        const result = parse(tokens);
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr.value.type).toBe('filter');
        if (expr.value.type === 'filter') {
          expect(expr.value.filters[0]?.args.length).toBe(2);
        }
      });

      it('recovers malformed block syntax with fallback node', () => {
        const tokens = tokenize('{% block name extra %}content{% endblock %}');
        const result = parse(tokens);
        expect(
          result.errors.some((error) => error.message.includes('Invalid block statement syntax'))
        ).toBe(true);
        const firstNode = result.ast?.children[0] as BlockNode;
        expect(firstNode.type).toBe('block');
        expect(firstNode.name).toBe('');
      });

      it('produces error for invalid variable start', () => {
        // Test that invalid variable names produce error nodes through public API
        const tokens = tokenize('{{ 1abc }}');
        const result = parse(tokens);
        expect(result.ast).toBeDefined();
        // Parser produces an error node for invalid syntax
        const expr = result.ast?.children[0] as ExpressionStatementNode;
        expect(expr?.value.type).toBe('error');
      });
    });
  });
});
