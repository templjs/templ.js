import { describe, it, expect } from 'vitest';
import { tokenize } from './lexer';
import { TokenType } from './types';

describe('Lexer - Default Delimiters', () => {
  describe('Basic Tokenization', () => {
    it('should tokenize plain text', () => {
      const tokens = tokenize('Hello World');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.TEXT);
      expect(tokens[0].content).toBe('Hello World');
    });

    it('should tokenize empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(0);
    });

    it('should tokenize single expression', () => {
      const tokens = tokenize('{{ name }}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EXPRESSION);
      expect(tokens[0].content).toBe('{{ name }}');
    });

    it('should tokenize single statement', () => {
      const tokens = tokenize('{% if true %}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.STATEMENT);
      expect(tokens[0].content).toBe('{% if true %}');
    });

    it('should tokenize single comment', () => {
      const tokens = tokenize('{# comment #}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.COMMENT);
      expect(tokens[0].content).toBe('{# comment #}');
    });

    it('should tokenize text with expression', () => {
      const tokens = tokenize('Hello {{ name }}!');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe(TokenType.TEXT);
      expect(tokens[0].content).toBe('Hello ');
      expect(tokens[1].type).toBe(TokenType.EXPRESSION);
      expect(tokens[1].content).toBe('{{ name }}');
      expect(tokens[2].type).toBe(TokenType.TEXT);
      expect(tokens[2].content).toBe('!');
    });

    it('should tokenize text with statement', () => {
      const tokens = tokenize('Start {% if x %} End');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('Start ');
      expect(tokens[1].content).toBe('{% if x %}');
      expect(tokens[2].content).toBe(' End');
    });

    it('should tokenize text with comment', () => {
      const tokens = tokenize('Before {# note #} After');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('Before ');
      expect(tokens[1].content).toBe('{# note #}');
      expect(tokens[2].content).toBe(' After');
    });
  });

  describe('Mixed Token Types', () => {
    it('should tokenize expression and statement', () => {
      const tokens = tokenize('{{ x }}{% if y %}');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.EXPRESSION);
      expect(tokens[1].type).toBe(TokenType.STATEMENT);
    });

    it('should tokenize statement and expression', () => {
      const tokens = tokenize('{% for i %}{{ i }}');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.STATEMENT);
      expect(tokens[1].type).toBe(TokenType.EXPRESSION);
    });

    it('should tokenize all token types', () => {
      const tokens = tokenize('Text {{ expr }} {% stmt %} {# comment #}');
      expect(tokens).toHaveLength(6);
      expect(tokens[0].type).toBe(TokenType.TEXT);
      expect(tokens[1].type).toBe(TokenType.EXPRESSION);
      expect(tokens[2].type).toBe(TokenType.TEXT);
      expect(tokens[3].type).toBe(TokenType.STATEMENT);
      expect(tokens[4].type).toBe(TokenType.TEXT);
      expect(tokens[5].type).toBe(TokenType.COMMENT);
    });

    it('should handle adjacent expressions', () => {
      const tokens = tokenize('{{ a }}{{ b }}{{ c }}');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('{{ a }}');
      expect(tokens[1].content).toBe('{{ b }}');
      expect(tokens[2].content).toBe('{{ c }}');
    });

    it('should handle adjacent statements', () => {
      const tokens = tokenize('{% if a %}{% endif %}{% for x %}');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('{% if a %}');
      expect(tokens[1].content).toBe('{% endif %}');
      expect(tokens[2].content).toBe('{% for x %}');
    });

    it('should handle adjacent comments', () => {
      const tokens = tokenize('{# one #}{# two #}{# three #}');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('{# one #}');
      expect(tokens[1].content).toBe('{# two #}');
      expect(tokens[2].content).toBe('{# three #}');
    });
  });

  describe('Complex Templates', () => {
    it('should tokenize if-else block', () => {
      const template = '{% if user %}Hello {{ user.name }}{% else %}Guest{% endif %}';
      const tokens = tokenize(template);
      expect(tokens).toHaveLength(6);
      expect(tokens[0].type).toBe(TokenType.STATEMENT);
      expect(tokens[1].type).toBe(TokenType.TEXT);
      expect(tokens[2].type).toBe(TokenType.EXPRESSION);
      expect(tokens[3].type).toBe(TokenType.STATEMENT);
      expect(tokens[4].type).toBe(TokenType.TEXT);
      expect(tokens[5].type).toBe(TokenType.STATEMENT);
    });

    it('should tokenize for loop', () => {
      const template = '{% for item in items %}{{ item }}{% endfor %}';
      const tokens = tokenize(template);
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('{% for item in items %}');
      expect(tokens[1].content).toBe('{{ item }}');
      expect(tokens[2].content).toBe('{% endfor %}');
    });

    it('should tokenize nested structures', () => {
      const template = '{% if x %}{% for y %}{{ y }}{% endfor %}{% endif %}';
      const tokens = tokenize(template);
      expect(tokens).toHaveLength(5);
    });
  });

  describe('Whitespace Handling', () => {
    it('should preserve whitespace in text', () => {
      const tokens = tokenize('  Hello  World  ');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('  Hello  World  ');
    });

    it('should preserve whitespace around expressions', () => {
      const tokens = tokenize('  {{ x }}  ');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('  ');
      expect(tokens[2].content).toBe('  ');
    });

    it('should handle tabs', () => {
      const tokens = tokenize('\t{{ x }}\t');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('\t');
      expect(tokens[2].content).toBe('\t');
    });

    it('should handle newlines in text', () => {
      const tokens = tokenize('Line 1\nLine 2\nLine 3');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle windows newlines', () => {
      const tokens = tokenize('Line 1\r\nLine 2');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('Line 1\r\nLine 2');
    });

    it('should handle mixed newlines', () => {
      const tokens = tokenize('Unix\nWindows\r\nMac\r');
      expect(tokens).toHaveLength(1);
    });
  });

  describe('Special Characters', () => {
    it('should handle single braces in text', () => {
      const tokens = tokenize('{ hello }');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{ hello }');
    });

    it('should handle partial delimiters in text', () => {
      const tokens = tokenize('{ % } { { } }');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{ % } { { } }');
    });

    it('should handle special regex characters', () => {
      const tokens = tokenize('$^*+?.()|[]{}\\');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('$^*+?.()|[]{}\\');
    });

    it('should handle unicode characters', () => {
      const tokens = tokenize('Hello 世界 🌍');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('Hello 世界 🌍');
    });

    it('should handle unicode in expressions', () => {
      const tokens = tokenize('{{ 世界 }}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{{ 世界 }}');
    });
  });

  describe('Expression Content', () => {
    it('should tokenize simple variable', () => {
      const tokens = tokenize('{{ x }}');
      expect(tokens[0].content).toBe('{{ x }}');
    });

    it('should tokenize dot notation', () => {
      const tokens = tokenize('{{ user.name.first }}');
      expect(tokens[0].content).toBe('{{ user.name.first }}');
    });

    it('should tokenize array access', () => {
      const tokens = tokenize('{{ items[0] }}');
      expect(tokens[0].content).toBe('{{ items[0] }}');
    });

    it('should tokenize function calls', () => {
      const tokens = tokenize('{{ format(date) }}');
      expect(tokens[0].content).toBe('{{ format(date) }}');
    });

    it('should tokenize operators', () => {
      const tokens = tokenize('{{ a + b * c }}');
      expect(tokens[0].content).toBe('{{ a + b * c }}');
    });

    it('should tokenize string literals', () => {
      const tokens = tokenize('{{ "hello world" }}');
      expect(tokens[0].content).toBe('{{ "hello world" }}');
    });

    it('should tokenize number literals', () => {
      const tokens = tokenize('{{ 42 }}');
      expect(tokens[0].content).toBe('{{ 42 }}');
    });

    it('should tokenize boolean literals', () => {
      const tokens = tokenize('{{ true }}');
      expect(tokens[0].content).toBe('{{ true }}');
    });

    it('should tokenize null', () => {
      const tokens = tokenize('{{ null }}');
      expect(tokens[0].content).toBe('{{ null }}');
    });

    it('should handle complex expressions', () => {
      const tokens = tokenize('{{ user.items[idx].name || "default" }}');
      expect(tokens[0].content).toBe('{{ user.items[idx].name || "default" }}');
    });
  });

  describe('Statement Content', () => {
    it('should tokenize if statement', () => {
      const tokens = tokenize('{% if condition %}');
      expect(tokens[0].content).toBe('{% if condition %}');
    });

    it('should tokenize else statement', () => {
      const tokens = tokenize('{% else %}');
      expect(tokens[0].content).toBe('{% else %}');
    });

    it('should tokenize elif statement', () => {
      const tokens = tokenize('{% elif other %}');
      expect(tokens[0].content).toBe('{% elif other %}');
    });

    it('should tokenize endif statement', () => {
      const tokens = tokenize('{% endif %}');
      expect(tokens[0].content).toBe('{% endif %}');
    });

    it('should tokenize for statement', () => {
      const tokens = tokenize('{% for item in items %}');
      expect(tokens[0].content).toBe('{% for item in items %}');
    });

    it('should tokenize endfor statement', () => {
      const tokens = tokenize('{% endfor %}');
      expect(tokens[0].content).toBe('{% endfor %}');
    });

    it('should tokenize while statement', () => {
      const tokens = tokenize('{% while condition %}');
      expect(tokens[0].content).toBe('{% while condition %}');
    });

    it('should tokenize set statement', () => {
      const tokens = tokenize('{% set x = 10 %}');
      expect(tokens[0].content).toBe('{% set x = 10 %}');
    });

    it('should tokenize import statement', () => {
      const tokens = tokenize('{% import "module" %}');
      expect(tokens[0].content).toBe('{% import "module" %}');
    });

    it('should handle complex conditions', () => {
      const tokens = tokenize('{% if a > 5 and b < 10 or c == null %}');
      expect(tokens[0].content).toBe('{% if a > 5 and b < 10 or c == null %}');
    });
  });

  describe('Comment Content', () => {
    it('should tokenize simple comment', () => {
      const tokens = tokenize('{# note #}');
      expect(tokens[0].content).toBe('{# note #}');
    });

    it('should handle comments with text', () => {
      const tokens = tokenize('{# This is a comment #}');
      expect(tokens[0].content).toBe('{# This is a comment #}');
    });

    it('should handle comments with special chars', () => {
      const tokens = tokenize('{# TODO: fix @#$%^&* #}');
      expect(tokens[0].content).toBe('{# TODO: fix @#$%^&* #}');
    });

    it('should handle multi-line comments', () => {
      const tokens = tokenize('{# line 1\nline 2\nline 3 #}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.COMMENT);
    });

    it('should handle empty comments', () => {
      const tokens = tokenize('{##}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{##}');
    });
  });
});

describe('Lexer - Position Tracking', () => {
  describe('Single Line Positions', () => {
    it('should track position for single text token', () => {
      const tokens = tokenize('Hello');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end).toEqual({ line: 1, column: 5 });
    });

    it('should track position for single expression', () => {
      const tokens = tokenize('{{ x }}');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end).toEqual({ line: 1, column: 7 });
    });

    it('should track position for single statement', () => {
      const tokens = tokenize('{% if x %}');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end).toEqual({ line: 1, column: 10 });
    });

    it('should track position for single comment', () => {
      const tokens = tokenize('{# note #}');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end).toEqual({ line: 1, column: 10 });
    });

    it('should track positions for multiple tokens', () => {
      const tokens = tokenize('A{{ x }}B');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end).toEqual({ line: 1, column: 1 });
      expect(tokens[1].start).toEqual({ line: 1, column: 1 });
      expect(tokens[1].end).toEqual({ line: 1, column: 8 });
      expect(tokens[2].start).toEqual({ line: 1, column: 8 });
      expect(tokens[2].end).toEqual({ line: 1, column: 9 });
    });
  });

  describe('Multi-Line Positions', () => {
    it('should track position across lines for text', () => {
      const tokens = tokenize('Line 1\nLine 2');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end).toEqual({ line: 2, column: 6 });
    });

    it('should track position for tokens on different lines', () => {
      const tokens = tokenize('Line 1\n{{ x }}\nLine 3');
      expect(tokens[0].start.line).toBe(1);
      expect(tokens[1].start.line).toBe(2);
      expect(tokens[2].start.line).toBe(2);
    });

    it('should track position for multi-line expression', () => {
      const tokens = tokenize('{{\n  x\n}}');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end.line).toBe(3);
    });

    it('should track position for multi-line statement', () => {
      const tokens = tokenize('{%\n  if x\n%}');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end.line).toBe(3);
    });

    it('should track position for multi-line comment', () => {
      const tokens = tokenize('{#\n  comment\n#}');
      expect(tokens[0].start).toEqual({ line: 1, column: 0 });
      expect(tokens[0].end.line).toBe(3);
    });
  });

  describe('Column Tracking', () => {
    it('should track columns correctly with spaces', () => {
      const tokens = tokenize('  {{ x }}  ');
      expect(tokens[0].start.column).toBe(0);
      expect(tokens[0].end.column).toBe(2);
      expect(tokens[1].start.column).toBe(2);
      expect(tokens[1].end.column).toBe(9);
      expect(tokens[2].start.column).toBe(9);
      expect(tokens[2].end.column).toBe(11);
    });

    it('should track columns with tabs', () => {
      const tokens = tokenize('\t{{ x }}\t');
      expect(tokens[0].start.column).toBe(0);
      expect(tokens[1].start.column).toBe(1);
      expect(tokens[2].start.column).toBe(8);
    });
  });
});

describe('Lexer - Custom Delimiters', () => {
  describe('Single Custom Delimiter', () => {
    it('should use custom expression delimiters', () => {
      const tokens = tokenize('[[ x ]]', {
        delimiters: {
          expression_start: '[[',
          expression_end: ']]',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EXPRESSION);
      expect(tokens[0].content).toBe('[[ x ]]');
    });

    it('should use custom statement delimiters', () => {
      const tokens = tokenize('<% if x %>', {
        delimiters: {
          statement_start: '<%',
          statement_end: '%>',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.STATEMENT);
      expect(tokens[0].content).toBe('<% if x %>');
    });

    it('should use custom comment delimiters', () => {
      const tokens = tokenize('/* note */', {
        delimiters: {
          comment_start: '/*',
          comment_end: '*/',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.COMMENT);
      expect(tokens[0].content).toBe('/* note */');
    });
  });

  describe('Multiple Custom Delimiters', () => {
    it('should use all custom delimiters', () => {
      const tokens = tokenize('[[ x ]] <% if y %> /* note */', {
        delimiters: {
          expression_start: '[[',
          expression_end: ']]',
          statement_start: '<%',
          statement_end: '%>',
          comment_start: '/*',
          comment_end: '*/',
        },
      });
      expect(tokens).toHaveLength(5);
      expect(tokens[0].type).toBe(TokenType.EXPRESSION);
      expect(tokens[2].type).toBe(TokenType.STATEMENT);
      expect(tokens[4].type).toBe(TokenType.COMMENT);
    });

    it('should mix custom and default delimiters', () => {
      const tokens = tokenize('[[ x ]] {% if y %}', {
        delimiters: {
          expression_start: '[[',
          expression_end: ']]',
        },
      });
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('[[ x ]]');
      expect(tokens[2].content).toBe('{% if y %}');
    });
  });

  describe('Special Custom Delimiters', () => {
    it('should handle regex special chars in delimiters', () => {
      const tokens = tokenize('${ x }', {
        delimiters: {
          expression_start: '${',
          expression_end: '}',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('${ x }');
    });

    it('should handle long delimiters', () => {
      const tokens = tokenize('<<<START x END>>>', {
        delimiters: {
          expression_start: '<<<START',
          expression_end: 'END>>>',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('<<<START x END>>>');
    });

    it('should handle single char delimiters', () => {
      const tokens = tokenize('< x >', {
        delimiters: {
          expression_start: '<',
          expression_end: '>',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('< x >');
    });

    it('should handle asymmetric delimiters', () => {
      const tokens = tokenize('{{ x }}}', {
        delimiters: {
          expression_start: '{{',
          expression_end: '}}}',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{{ x }}}');
    });
  });

  describe('Delimiter Edge Cases', () => {
    it('should handle delimiters with whitespace', () => {
      const tokens = tokenize('< % x % >', {
        delimiters: {
          statement_start: '< %',
          statement_end: '% >',
        },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('< % x % >');
    });

    it('should treat old delimiters as text with custom delimiters', () => {
      const tokens = tokenize('{{ x }} [[ y ]]', {
        delimiters: {
          expression_start: '[[',
          expression_end: ']]',
        },
      });
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.TEXT);
      expect(tokens[0].content).toBe('{{ x }} ');
      expect(tokens[1].type).toBe(TokenType.EXPRESSION);
      expect(tokens[1].content).toBe('[[ y ]]');
    });
  });
});

describe('Lexer - Error Handling', () => {
  describe('Unclosed Delimiters', () => {
    it('should error on unclosed expression', () => {
      expect(() => tokenize('{{ x')).toThrow(/unclosed expression/i);
    });

    it('should error on unclosed statement', () => {
      expect(() => tokenize('{% if x')).toThrow(/unclosed statement/i);
    });

    it('should error on unclosed comment', () => {
      expect(() => tokenize('{# note')).toThrow(/unclosed comment/i);
    });

    it('should report position in error for unclosed expression', () => {
      expect(() => tokenize('{{ x')).toThrow(/line 1.*column 0/i);
    });

    it('should report position in error for unclosed statement', () => {
      expect(() => tokenize('{% if')).toThrow(/line 1.*column 0/i);
    });

    it('should report position in error for unclosed comment', () => {
      expect(() => tokenize('{# note')).toThrow(/line 1.*column 0/i);
    });

    it('should error on unclosed expression with text before', () => {
      expect(() => tokenize('Hello {{ x')).toThrow(/unclosed expression/i);
    });

    it('should error on unclosed expression on second line', () => {
      expect(() => tokenize('Line 1\n{{ x')).toThrow(/line 2/i);
    });
  });

  describe('Malformed Delimiters', () => {
    it('should handle partial expression start', () => {
      const tokens = tokenize('{ { x }}');
      // This should be treated as text since delimiter doesn't match
      expect(tokens[0].type).toBe(TokenType.TEXT);
    });

    it('should handle partial statement start', () => {
      const tokens = tokenize('{ % x %}');
      expect(tokens[0].type).toBe(TokenType.TEXT);
    });

    it('should handle partial comment start', () => {
      const tokens = tokenize('{ # x #}');
      expect(tokens[0].type).toBe(TokenType.TEXT);
    });
  });
});

describe('Lexer - Edge Cases', () => {
  describe('Empty Content', () => {
    it('should handle empty expressions', () => {
      const tokens = tokenize('{{}}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{{}}');
    });

    it('should handle empty statements', () => {
      const tokens = tokenize('{%%}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{%%}');
    });

    it('should handle empty comments', () => {
      const tokens = tokenize('{##}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('{##}');
    });
  });

  describe('Delimiter Lookalikes', () => {
    it('should not confuse similar delimiters', () => {
      const tokens = tokenize('{{ x }} {% y %} {# z #}');
      expect(tokens[0].type).toBe(TokenType.EXPRESSION);
      expect(tokens[2].type).toBe(TokenType.STATEMENT);
      expect(tokens[4].type).toBe(TokenType.COMMENT);
    });

    it('should handle nested braces in expressions', () => {
      const tokens = tokenize('{{ {a: 1} }}');
      expect(tokens[0].type).toBe(TokenType.EXPRESSION);
      expect(tokens[0].content).toBe('{{ {a: 1} }}');
    });

    it('should handle nested braces in statements', () => {
      const tokens = tokenize('{% set x = {a: 1} %}');
      expect(tokens[0].type).toBe(TokenType.STATEMENT);
    });
  });

  describe('Long Content', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      const tokens = tokenize(longText);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toHaveLength(10000);
    });

    it('should handle many tokens', () => {
      const template = '{{ x }} '.repeat(1000);
      const tokens = tokenize(template);
      expect(tokens.length).toBeGreaterThan(1000);
    });
  });

  describe('Real-World Templates', () => {
    it('should tokenize HTML template', () => {
      const template = '<div>{{ user.name }}</div>';
      const tokens = tokenize(template);
      expect(tokens).toHaveLength(3);
      expect(tokens[0].content).toBe('<div>');
      expect(tokens[1].content).toBe('{{ user.name }}');
      expect(tokens[2].content).toBe('</div>');
    });

    it('should tokenize JSON template', () => {
      const template = '{"name": "{{ name }}", "age": {{ age }}}';
      const tokens = tokenize(template);
      expect(tokens.some((t) => t.type === TokenType.EXPRESSION)).toBe(true);
    });

    it('should tokenize YAML template', () => {
      const template = 'name: {{ name }}\nage: {{ age }}';
      const tokens = tokenize(template);
      expect(tokens.some((t) => t.type === TokenType.EXPRESSION)).toBe(true);
    });

    it('should tokenize Markdown template', () => {
      const template = '# {{ title }}\n\n{{ content }}';
      const tokens = tokenize(template);
      expect(tokens.some((t) => t.type === TokenType.EXPRESSION)).toBe(true);
    });

    it('should tokenize SQL template', () => {
      const template = 'SELECT * FROM users WHERE id = {{ userId }}';
      const tokens = tokenize(template);
      expect(tokens.some((t) => t.type === TokenType.EXPRESSION)).toBe(true);
    });
  });
});

describe('Lexer - Performance', () => {
  it('should tokenize 4KB template in < 1ms', () => {
    // Create a 4KB template
    const chunk = 'Text {{ expr }} {% stmt %} {# comment #}\n';
    const iterations = Math.ceil(4096 / chunk.length);
    const template = chunk.repeat(iterations);

    const start = performance.now();
    tokenize(template);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1);
  });

  it('should tokenize 10KB plain text quickly', () => {
    const template = 'a'.repeat(10240);
    const start = performance.now();
    tokenize(template);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(2);
  });

  it('should tokenize 100 expressions quickly', () => {
    const template = '{{ x }}'.repeat(100);
    const start = performance.now();
    tokenize(template);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });
});

describe('Lexer - Integration Tests', () => {
  it('should tokenize complete if-else template', () => {
    const template = `
{% if user %}
  <div class="user">
    <h1>{{ user.name }}</h1>
    <p>{{ user.email }}</p>
  </div>
{% else %}
  <div class="guest">
    <p>Please log in</p>
  </div>
{% endif %}
    `.trim();

    const tokens = tokenize(template);
    expect(tokens.length).toBe(9);
  });

  it('should tokenize loop with filter', () => {
    const template = `
{% for item in items %}
  {{ item.name }}: {{ item.value }}
{% endfor %}
    `.trim();

    const tokens = tokenize(template);
    expect(tokens.some((t) => t.content.includes('for'))).toBe(true);
    expect(tokens.filter((t) => t.type === TokenType.EXPRESSION).length).toBe(2);
  });

  it('should tokenize nested loops', () => {
    const template = `
{% for category in categories %}
  <h2>{{ category.name }}</h2>
  {% for item in category.items %}
    <li>{{ item }}</li>
  {% endfor %}
{% endfor %}
    `.trim();

    const tokens = tokenize(template);
    expect(tokens.filter((t) => t.content.includes('for')).length).toBe(4);
  });

  it('should tokenize template with comments', () => {
    const template = `
{# User profile section #}
<div>
  {# Display user name #}
  {{ user.name }}
  {# Display user bio #}
  {{ user.bio }}
</div>
    `.trim();

    const tokens = tokenize(template);
    expect(tokens.filter((t) => t.type === TokenType.COMMENT).length).toBe(3);
  });
});
