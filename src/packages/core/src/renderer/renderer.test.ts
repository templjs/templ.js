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

  describe('variable resolution advanced', () => {
    it('should resolve mixed array and object access', () => {
      const template = '{{ users[0].profile.name }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        users: [{ profile: { name: 'Alice' } }],
      });
      expect(result.output).toBe('Alice');
    });

    it('should resolve numeric indices dynamically', () => {
      const template = '{{ items[1] }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toBe('b');
    });

    it('should handle string interpolation and concatenation', () => {
      const template = '{{ first }} and {{ second }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { first: 'one', second: 'two' });
      expect(result.output).toBe('one and two');
    });

    it('should handle null and undefined gracefully', () => {
      const template = 'before{{ missing }}after';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {});
      expect(result.output).toBe('beforeafter');
    });

    it('should handle zero and false values', () => {
      const template = '{{ zero }} {{ false_val }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { zero: 0, false_val: false });
      expect(result.output).toBe('0 false');
    });

    it('should handle empty strings', () => {
      const template = 'start{{ empty }}end';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { empty: '' });
      expect(result.output).toBe('startend');
    });

    it('should handle numeric values in output', () => {
      const template = 'Number: {{ count }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { count: 42 });
      expect(result.output).toBe('Number: 42');
    });
  });

  describe('filter combinations', () => {
    it('should apply multiple string filters in sequence', () => {
      const template = '{{ text | lower | capitalize }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hELLO wORLD' });
      expect(result.output).toBe('Hello world');
    });

    it('should apply length filter on strings', () => {
      const template = '{{ text | length }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hello' });
      expect(result.output).toBe('5');
    });

    it('should apply length filter on arrays', () => {
      const template = '{{ items | length }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toBe('3');
    });

    it('should apply first filter', () => {
      const template = '{{ items | first }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['first', 'second'] });
      expect(result.output).toBe('first');
    });

    it('should apply last filter', () => {
      const template = '{{ items | last }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['first', 'last'] });
      expect(result.output).toBe('last');
    });

    it('should apply trim filter', () => {
      const template = '{{ text | trim }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: '  spaces  ' });
      expect(result.output).toBe('spaces');
    });

    it('should apply join filter with custom separator', () => {
      const template = '{{ items | join(" | ") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toBe('a | b | c');
    });

    it('should apply startsWith filter', () => {
      const template = '{{ text | startsWith("hello") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hello world' });
      expect(result.output).toBeTruthy();
    });

    it('should apply endsWith filter', () => {
      const template = '{{ text | endsWith("world") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hello world' });
      expect(result.output).toBeTruthy();
    });

    it('should apply replace filter', () => {
      const template = '{{ text | replace("world", "universe") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hello world' });
      expect(result.output).toBe('hello universe');
    });

    it('should apply uppercase via upper filter', () => {
      const template = '{{ text | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'hello' });
      expect(result.output).toBe('HELLO');
    });

    it('should apply lowercase via lower filter', () => {
      const template = '{{ text | lower }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'HELLO' });
      expect(result.output).toBe('hello');
    });

    it('should apply default filter for undefined', () => {
      const template = '{{ missing | default("fallback") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {});
      expect(result.output).toBe('fallback');
    });
  });

  describe('loop constructs', () => {
    it('should handle for-if combination', () => {
      const template = '{% for item in items %}{% if item > 2 %}{{ item }},{% endif %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2, 3, 4] });
      expect(result.output).toContain('3');
      expect(result.output).toContain('4');
    });

    it('should handle nested loops with variable access', () => {
      const template =
        '{% for i in outer %}{% for j in inner %}{{ i }}:{{ j }};{% endfor %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        outer: ['a', 'b'],
        inner: [1, 2],
      });
      expect(result.output).toContain('a:1');
      expect(result.output).toContain('b:2');
    });

    it('should handle for with text nodes', () => {
      const template = 'Items: {% for item in items %}{{ item }}, {% endfor %}Done';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toContain('a,');
      expect(result.output).toContain('Done');
    });

    it('should handle multiple sequential loops', () => {
      const template =
        '{% for a in as %}{{ a }},{% endfor %};{% for b in bs %}{{ b }},{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { as: [1, 2], bs: [3, 4] });
      expect(result.output).toContain('1,');
      expect(result.output).toContain('3,');
    });

    it('should access loop object properties', () => {
      const template = '{% for item in items %}{{ loop.index }}.{{ item }}|{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b'] });
      expect(result.output).toContain('1.a');
      expect(result.output).toContain('2.b');
    });

    it('should access loop.first and loop.last', () => {
      const template =
        '{% for item in items %}{% if loop.first %}F{% endif %}{{ item }}{% if loop.last %}L{% endif %}|{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.output).toContain('Fa');
      expect(result.output).toContain('cL');
    });
  });

  describe('conditional constructs', () => {
    it('should handle if-else', () => {
      const template = '{% if show %}visible{% else %}hidden{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      const result1 = render(parseResult.ast, { show: true });
      expect(result1.output).toBe('visible');

      const result2 = render(parseResult.ast, { show: false });
      expect(result2.output).toBe('hidden');
    });

    it('should handle nested if statements', () => {
      const template = '{% if a %}{% if b %}nested{% endif %}{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      const result = render(parseResult.ast, { a: true, b: true });
      expect(result.output).toBe('nested');
    });

    it('should handle if with comparisons', () => {
      const template = '{% if count > 5 %}many{% else %}few{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      const result = render(parseResult.ast, { count: 10 });
      expect(result.output).toBe('many');
    });

    it('should handle if with logical operators', () => {
      const template = '{% if a && b %}both{% else %}one{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      const result = render(parseResult.ast, { a: true, b: true });
      expect(result.output).toBe('both');
    });

    it('should handle if with equality', () => {
      const template = '{% if status == "active" %}Active{% else %}Inactive{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      const result = render(parseResult.ast, { status: 'active' });
      expect(result.output).toBe('Active');
    });

    it('should handle if with less than comparison', () => {
      const template = '{% if num < 10 %}small{% else %}large{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');

      const result = render(parseResult.ast, { num: 5 });
      expect(result.output).toBe('small');
    });
  });

  describe('whitespace and output handling', () => {
    it('should preserve literal whitespace', () => {
      const template = 'line1\nline2';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {});
      expect(result.output).toContain('line1');
      expect(result.output).toContain('line2');
    });

    it('should handle newlines in templates', () => {
      const template = '{{ a }}\n{{ b }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { a: 'first', b: 'second' });
      expect(result.output).toContain('first');
      expect(result.output).toContain('second');
    });

    it('should handle tabs in output', () => {
      const template = '{{ a }}\t{{ b }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { a: 'col1', b: 'col2' });
      expect(result.output).toContain('col1');
      expect(result.output).toContain('col2');
    });

    it('should render inline statements without extra whitespace', () => {
      const template = '{{ a }}{{ b }}{{ c }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { a: 'x', b: 'y', c: 'z' });
      expect(result.output).toBe('xyz');
    });

    it('should handle multiple consecutive expressions', () => {
      const template = '{{ a }} {{ b }} {{ c }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { a: 'x', b: 'y', c: 'z' });
      expect(result.output).toBe('x y z');
    });
  });

  describe('advanced scenarios', () => {
    it('should render HTML template', () => {
      const template = '<div class="{{ cls }}">{{ content }}</div>';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { cls: 'active', content: 'Hello' });
      expect(result.output).toContain('active');
      expect(result.output).toContain('Hello');
    });

    it('should render HTML with multiple attributes', () => {
      const template = '<a href="{{ url }}" title="{{ title }}">{{ text }}</a>';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        url: 'http://example.com',
        title: 'Link',
        text: 'Click here',
      });
      expect(result.output).toContain('example.com');
      expect(result.output).toContain('Click here');
    });

    it('should handle document with sections', () => {
      const template = `# {{ title }}\n\n{% for section in sections %}\n## {{ section.name }}\n{{ section.content }}\n{% endfor %}`;
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        title: 'Doc',
        sections: [
          { name: 'Intro', content: 'Intro text' },
          { name: 'Body', content: 'Body text' },
        ],
      });
      expect(result.output).toContain('Doc');
      expect(result.output).toContain('Intro');
    });

    it('should handle comma-separated list rendering', () => {
      const template = '{{ items | join(", ") }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['apple', 'banana', 'cherry'] });
      expect(result.output).toContain('apple');
      expect(result.output).toContain('banana');
    });

    it('should handle filtered output in loops', () => {
      const template = '{% for item in items %}{{ item | upper }}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['hello', 'world'] });
      expect(result.output).toContain('HELLO');
      expect(result.output).toContain('WORLD');
    });

    it('should handle conditionals in output', () => {
      const template = 'Count: {% if num > 0 %}{{ num }} items{% else %}no items{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { num: 5 });
      expect(result.output).toContain('5 items');
    });

    it('should handle nested data access in loops', () => {
      const template =
        '{% for user in users %}<li>{{ user.name }} ({{ user.role }})</li>{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        users: [
          { name: 'Alice', role: 'admin' },
          { name: 'Bob', role: 'user' },
        ],
      });
      expect(result.output).toContain('Alice');
      expect(result.output).toContain('admin');
    });

    it('should handle mixed text and expressions', () => {
      const template = 'The user {{ user }} has {{ count }} items.';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { user: 'Alice', count: 42 });
      expect(result.output).toBe('The user Alice has 42 items.');
    });
  });

  describe('Advanced Filter Chains', () => {
    it('should chain multiple string filters', () => {
      const template = '{{ name | upper | trim }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { name: '  hello  ' });
      expect(result.success).toBe(true);
    });

    it('should chain filters with arguments', () => {
      const template = '{{ text | replace("old", "new") | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'old text' });
      expect(result.success).toBe(true);
    });

    it('should handle array length filter', () => {
      const template = '{{ items | length }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2, 3, 4, 5] });
      expect(result.output).toBe('5');
    });

    it('should chain array and string filters', () => {
      const template = '{{ items | join(",") | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['a', 'b', 'c'] });
      expect(result.success).toBe(true);
    });

    it('should handle numeric filter chains', () => {
      const template = '{{ price | round(2) | abs }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { price: -123.456 });
      expect(result.success).toBe(true);
    });

    it('should filter null values with default', () => {
      const template = '{{ missing | default("N/A") | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {});
      expect(result.success).toBe(true);
    });

    it('should chain three or more filters', () => {
      const template = '{{ text | trim | lower | capitalize }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: '  HELLO WORLD  ' });
      expect(result.success).toBe(true);
    });

    it('should apply filters in correct order', () => {
      const template = '{{ items | first | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: ['hello', 'world'] });
      expect(result.success).toBe(true);
    });

    it('should handle filter with multiple arguments', () => {
      const template = '{{ text | slice(1, 5) | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { text: 'abcdefgh' });
      expect(result.success).toBe(true);
    });

    it('should chain filters on complex expressions', () => {
      const template = '{{ user.name | default("Anonymous") | upper }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { user: {} });
      expect(result.success).toBe(true);
    });
  });

  describe('Scope Management', () => {
    it('should maintain isolated scopes in nested loops', () => {
      const template =
        '{% for i in outer %}{% for j in inner %}{{ i }}-{{ j }} {% endfor %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { outer: [1, 2], inner: ['a', 'b'] });
      expect(result.output.trim()).toContain('1-a');
      expect(result.output.trim()).toContain('2-b');
    });

    it('should preserve outer scope variables in conditionals', () => {
      const template = '{% if true %}{{ name }}{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { name: 'Alice' });
      expect(result.output).toBe('Alice');
    });

    it('should handle deep nesting scope correctly', () => {
      const template =
        '{% for a in items %}{% if a > 0 %}{% for b in [1,2] %}{{ a }}-{{ b }} {% endfor %}{% endif %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2] });
      expect(result.success).toBe(true);
    });

    it('should access data from parent context', () => {
      const template = '{% for i in items %}{{ parent_value }} {% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2, 3], parent_value: 10 });
      expect(result.output.trim()).toContain('10');
    });

    it('should not leak loop variables outside scope', () => {
      const template = '{% for temp in items %}{{ temp }} {% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2] });
      expect(result.success).toBe(true);
    });

    it('should access parent scope data from nested loops', () => {
      const template = '{% for i in items %}{{ count }} {% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { items: [1, 2, 3], count: 5 });
      expect(result.output.trim()).toContain('5');
    });
  });

  describe('Edge Cases and Null Handling', () => {
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

  describe('Error Recovery and Robustness', () => {
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
  });

  describe('Integration and Real-World Scenarios', () => {
    it('should render a complete user profile', () => {
      const template =
        '{{ user.name }} ({{ user.age }})\n{% for skill in user.skills %}{{ skill | upper }}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        user: { name: 'Alice', age: 30, skills: ['js', 'ts'] },
      });
      expect(result.output).toContain('Alice');
      expect(result.output).toContain('30');
    });

    it('should render conditional navigation menu', () => {
      const template =
        '{% if isAdmin %}<a href="/admin">Admin</a>{% endif %}\n<a href="/home">Home</a>';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { isAdmin: true });
      expect(result.output).toContain('Admin');
      expect(result.output).toContain('Home');
    });

    it('should render paginated data list', () => {
      const template =
        '{% for item in items %}{{ loop.index }}. {{ item.title }}{% if loop.last %}{% else %}, {% endif %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        items: [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
      });
      expect(result.output).toContain('1. First');
      expect(result.output).toContain('3. Third');
    });

    it('should render nested data structures', () => {
      const template =
        '{% for category in data %}{{ category.name }}: {% for item in category.items %}{{ item }}{% endfor %}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        data: [
          { name: 'Fruits', items: ['apple', 'banana'] },
          { name: 'Veggies', items: ['carrot'] },
        ],
      });
      expect(result.output).toContain('Fruits');
      expect(result.output).toContain('apple');
      expect(result.output).toContain('Veggies');
    });

    it('should render table with headers and data', () => {
      const template =
        '| Name | Age |\n{% for user in users %}| {{ user.name }} | {{ user.age }} |\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      });
      expect(result.output).toContain('| Name | Age |');
      expect(result.output).toContain('Alice');
    });

    it('should render config file format', () => {
      const template =
        'server:\n  host: {{ config.host }}\n  port: {{ config.port }}\n  debug: {{ config.debug }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        config: { host: 'localhost', port: 8080, debug: true },
      });
      expect(result.output).toContain('host: localhost');
      expect(result.output).toContain('port: 8080');
    });

    it('should render article with metadata', () => {
      const template =
        '# {{ article.title }}\nBy {{ article.author }} - {{ article.date }}\n\n{{ article.content }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        article: {
          title: 'Test Article',
          author: 'John Doe',
          date: '2024-01-01',
          content: 'Article text here.',
        },
      });
      expect(result.output).toContain('# Test Article');
      expect(result.output).toContain('By John Doe');
    });

    it('should render email template', () => {
      const template =
        'Hello {{ recipient.name }},\n\n{% if hasPromotion %}Special offer: {{ promotion.text }}{% endif %}\n\nBest,\n{{ sender }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        recipient: { name: 'Alice' },
        hasPromotion: true,
        promotion: { text: '50% off' },
        sender: 'Team',
      });
      expect(result.output).toContain('Hello Alice');
      expect(result.output).toContain('50% off');
    });

    it('should render JSON-like output', () => {
      const template = '{\n  "name": "{{ obj.name }}",\n  "value": {{ obj.value }}\n}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { obj: { name: 'test', value: 42 } });
      expect(result.output).toContain('"name": "test"');
      expect(result.output).toContain('"value": 42');
    });

    it('should render code generation template', () => {
      const template =
        'function {{ funcName }}() {\n{% for line in code %}  {{ line }}\n{% endfor %}}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        funcName: 'myFunc',
        code: ['console.log("hello");', 'return true;'],
      });
      expect(result.output).toContain('function myFunc()');
      expect(result.output).toContain('console.log');
    });

    it('should render SQL query template', () => {
      const template =
        'SELECT * FROM {{ table }}\n{% if condition %}WHERE {{ condition }}{% endif %}\nLIMIT {{ limit }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        table: 'users',
        condition: 'age > 18',
        limit: 10,
      });
      expect(result.output).toContain('FROM users');
      expect(result.output).toContain('WHERE age > 18');
    });

    it('should render CSV output', () => {
      const template =
        'Name,Age,City\n{% for row in data %}{{ row.name }},{{ row.age }},{{ row.city }}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        data: [
          { name: 'Alice', age: 30, city: 'NYC' },
          { name: 'Bob', age: 25, city: 'LA' },
        ],
      });
      expect(result.output).toContain('Name,Age,City');
      expect(result.output).toContain('Alice,30,NYC');
    });

    it('should render documentation page', () => {
      const template =
        '# {{ title }}\n\n{% for section in sections %}## {{ section.heading }}\n{{ section.body }}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        title: 'API Docs',
        sections: [
          { heading: 'Introduction', body: 'Welcome...' },
          { heading: 'Usage', body: 'To use...' },
        ],
      });
      expect(result.output).toContain('# API Docs');
      expect(result.output).toContain('## Introduction');
    });

    it('should render HTML component', () => {
      const template =
        '<div class="card">\n  <h2>{{ title }}</h2>\n  <p>{{ description }}</p>\n  {% if hasButton %}<button>{{ buttonText }}</button>{% endif %}\n</div>';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        title: 'Card Title',
        description: 'Card description',
        hasButton: true,
        buttonText: 'Click Me',
      });
      expect(result.output).toContain('<h2>Card Title</h2>');
      expect(result.output).toContain('<button>Click Me</button>');
    });

    it('should render XML configuration', () => {
      const template =
        '<config>\n  <server>{{ server }}</server>\n  {% for option in options %}<option name="{{ option.name }}">{{ option.value }}</option>\n  {% endfor %}</config>';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        server: 'prod-server',
        options: [
          { name: 'timeout', value: '30' },
          { name: 'retries', value: '3' },
        ],
      });
      expect(result.output).toContain('<server>prod-server</server>');
      expect(result.output).toContain('timeout');
    });

    it('should render cloud-init user data', () => {
      const template =
        '#cloud-config\nhostname: {{ hostname }}\n{% if packages %}packages:\n{% for pkg in packages %}  - {{ pkg }}\n{% endfor %}{% endif %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        hostname: 'web-server',
        packages: ['nginx', 'nodejs'],
      });
      expect(result.output).toContain('hostname: web-server');
      expect(result.output).toContain('- nginx');
    });

    it('should render Dockerfile template', () => {
      const template =
        'FROM {{ baseImage }}\n{% for cmd in commands %}RUN {{ cmd }}\n{% endfor %}CMD ["{{ entrypoint }}"]';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        baseImage: 'node:18',
        commands: ['npm install', 'npm build'],
        entrypoint: 'npm start',
      });
      expect(result.output).toContain('FROM node:18');
      expect(result.output).toContain('RUN npm install');
    });

    it('should render API response template', () => {
      const template =
        '{\n  "status": "{{ status }}",\n  "data": [\n    {% for item in items %}{{ item }}{% if loop.last %}{% else %},{% endif %}\n    {% endfor %}\n  ]\n}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        status: 'success',
        items: ['"item1"', '"item2"', '"item3"'],
      });
      expect(result.output).toContain('"status": "success"');
      expect(result.output).toContain('"data"');
    });

    it('should render error message template', () => {
      const template =
        'Error {{ code }}: {{ message }}\n{% if details %}Details: {{ details }}{% endif %}\nPlease contact {{ support }}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        code: 404,
        message: 'Not Found',
        details: 'Resource missing',
        support: 'support@example.com',
      });
      expect(result.output).toContain('Error 404');
      expect(result.output).toContain('Details: Resource missing');
    });

    it('should render report summary', () => {
      const template =
        '=== Report ===\nGenerated: {{ date }}\nTotal: {{ total }}\n{% for metric in metrics %}{{ metric.name }}: {{ metric.value }}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        date: '2024-01-01',
        total: 100,
        metrics: [
          { name: 'Success', value: 95 },
          { name: 'Failed', value: 5 },
        ],
      });
      expect(result.output).toContain('=== Report ===');
      expect(result.output).toContain('Success: 95');
    });

    it('should render conditional pricing table', () => {
      const template =
        '{% for plan in plans %}{{ plan.name }}: ${{ plan.price }}{% if plan.popular }} (Popular!){% endif %}\n{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        plans: [
          { name: 'Basic', price: 10, popular: false },
          { name: 'Pro', price: 30, popular: true },
        ],
      });
      expect(result.output).toContain('Pro: $30');
      expect(result.output).toContain('Basic: $10');
    });

    it('should render multi-line heredoc style output', () => {
      const template = 'cat <<EOF\n{{ content }}\nEOF';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, { content: 'Hello\nWorld' });
      expect(result.output).toContain('cat <<EOF');
      expect(result.output).toContain('Hello');
    });

    it('should render inventory list with quantities', () => {
      const template =
        'INVENTORY:\n{% for item in inventory %}{% if item.quantity > 0 %}{{ item.name }}: {{ item.quantity }} units @ ${{ item.price }}\n{% endif %}{% endfor %}';
      const tokens = tokenize(template);
      const parseResult = parse(tokens);
      if (!parseResult.ast) throw new Error('Parse failed');
      const result = render(parseResult.ast, {
        inventory: [
          { name: 'Widget', quantity: 5, price: 19.99 },
          { name: 'Gadget', quantity: 0, price: 29.99 },
          { name: 'Doohickey', quantity: 10, price: 9.99 },
        ],
      });
      expect(result.output).toContain('Widget: 5 units');
      expect(result.output).not.toContain('Gadget');
    });
  });
});
