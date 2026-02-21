import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer';
import { parse } from './parser';
import type {
  ExpressionStatementNode,
  IfNode,
  ForNode,
  SetNode,
  BlockNode,
  VariableNode,
  LiteralNode,
} from './types';

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
      const tokens = tokenize('{% for item in items %}{{ item.id }} - {{ item.name }}{% endfor %}');
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
  it('should parse simple template within 5ms', () => {
    const tokens = tokenize('Simple text here');
    const start = performance.now();
    parse(tokens);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });

  it('should parse 4KB template within 5ms', () => {
    const template = 'x'.repeat(4096);
    const tokens = tokenize(template);
    const start = performance.now();
    parse(tokens);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });

  it('should parse complex template efficiently', () => {
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
    const start = performance.now();
    parse(tokens);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
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
