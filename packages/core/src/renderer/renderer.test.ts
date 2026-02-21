import { describe, it, expect } from 'vitest';
import { render } from './renderer';
import { parse } from '../parser';
import { tokenize } from '../lexer';

describe('Renderer', () => {
  describe('variable resolution', () => {
    it('should resolve simple variables', () => {
      const template = 'Hello {{ name }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { name: 'World' });
      expect(result.output).toBe('Hello World');
    });

    it('should resolve nested properties with dot notation', () => {
      const template = '{{ user.profile.name }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        user: { profile: { name: 'Alice' } },
      });
      expect(result.output).toBe('Alice');
    });

    it('should handle array access', () => {
      const template = '{{ items[0] }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['first', 'second'] });
      expect(result.output).toBe('first');
    });

    it('should handle undefined variables gracefully', () => {
      const template = '{{ missing }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {});
      expect(result.output).toBe('');
    });

    it('should handle deeply nested properties', () => {
      const template = '{{ a.b.c.d.e }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        a: { b: { c: { d: { e: 'deep' } } } },
      });
      expect(result.output).toBe('deep');
    });
  });

  describe('filters', () => {
    it('should apply upper filter', () => {
      const template = '{{ text | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hello' });
      expect(result.output).toBe('HELLO');
    });

    it('should apply lower filter', () => {
      const template = '{{ text | lower }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'HELLO' });
      expect(result.output).toBe('hello');
    });

    it('should chain multiple filters', () => {
      const template = '{{ text | lower | capitalize }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hELLO wORLD' });
      expect(result.output).toBe('Hello world');
    });

    it('should apply default filter for undefined', () => {
      const template = '{{ missing | default("fallback") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {});
      expect(result.output).toBe('fallback');
    });

    it('should apply trim filter', () => {
      const template = '{{ text | trim }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: '  spaces  ' });
      expect(result.output).toBe('spaces');
    });
  });

  describe('conditional blocks', () => {
    it('should render if block when condition is true', () => {
      const template = '{% if show %}visible{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { show: true });
      expect(result.output).toBe('visible');
    });

    it('should skip if block when condition is false', () => {
      const template = '{% if show %}visible{% endif %}hidden';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { show: false });
      expect(result.output).toBe('hidden');
    });

    it('should render else block when condition is false', () => {
      const template = '{% if show %}yes{% else %}no{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { show: false });
      expect(result.output).toBe('no');
    });

    it('should handle nested if statements', () => {
      const template = '{% if a %}{% if b %}both{% endif %}{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { a: true, b: true });
      expect(result.output).toBe('both');
    });

    it('should evaluate falsy values as false', () => {
      const template = '{% if val %}yes{% else %}no{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      expect(render(parseResult.ast, { val: false }).output).toBe('no');
      expect(render(parseResult.ast, { val: 0 }).output).toBe('no');
      expect(render(parseResult.ast, { val: '' }).output).toBe('no');
      expect(render(parseResult.ast, { val: null }).output).toBe('no');
      expect(render(parseResult.ast, { val: undefined }).output).toBe('no');
    });
  });

  describe('loops', () => {
    it('should iterate over array', () => {
      const template = '{% for item in items %}{{ item }}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toBe('abc');
    });

    it('should provide index in loop', () => {
      const template = '{% for item in items %}{{ loop.index }}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2, 3] });
      expect(result.output).toBe('123');
    });

    it('should provide first and last in loop', () => {
      const template =
        '{% for item in items %}{% if loop.first %}F{% endif %}{{ item }}{% if loop.last %}L{% endif %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toContain('Fa');
      expect(result.output).toContain('cL');
    });

    it('should provide length in loop', () => {
      const template = '{% for item in items %}{{ loop.length }}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toBe('333');
    });

    it('should handle nested loops', () => {
      const template =
        '{% for i in outer %}{% for j in inner %}{{ i }}{{ j }}{% endfor %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        outer: ['a', 'b'],
        inner: ['1', '2'],
      });
      expect(result.output).toBe('a1a2b1b2');
    });

    it('should skip empty arrays', () => {
      const template = '{% for item in items %}x{% endfor %}empty';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [] });
      expect(result.output).toBe('empty');
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed template with text, variables, and blocks', () => {
      const template = `
        {% if user %}
          Hello {{ user.name | capitalize }}!
          {% if user.skills %}
            Skills:
            {% for skill in user.skills %}
              - {{ skill | upper }}
            {% endfor %}
          {% endif %}
        {% else %}
          Please log in
        {% endif %}
      `;
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        user: {
          name: 'alice',
          skills: ['typescript', 'javascript'],
        },
      });

      expect(result.output).toContain('Hello Alice');
      expect(result.output).toContain('TYPESCRIPT');
      expect(result.output).toContain('JAVASCRIPT');
    });

    it('should handle contexts with mixed types', () => {
      const template = `
        String: {{ str }}
        Number: {{ num }}
        Boolean: {{ bool }}
        Array: {{ arr[0] }}
        Object: {{ obj.key }}
      `;
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        str: 'hello',
        num: 42,
        bool: true,
        arr: ['item'],
        obj: { key: 'value' },
      });

      expect(result.output).toContain('String: hello');
      expect(result.output).toContain('Number: 42');
      expect(result.output).toContain('Boolean: true');
      expect(result.output).toContain('Array: item');
      expect(result.output).toContain('Object: value');
    });
  });

  describe('error handling', () => {
    it('should handle type errors gracefully', () => {
      const template = '{{ x | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { x: 123 });
      // Should convert to string then uppercase
      expect(result.output).toBe('123');
    });

    it('should handle circular references', () => {
      const data: any = { name: 'test' };
      data.self = data;

      const template = '{{ name }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, data);
      expect(result.output).toBe('test');
    });
  });
});
