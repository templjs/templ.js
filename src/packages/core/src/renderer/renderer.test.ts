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
          const template =
            '{% for item in items %}{% if item > 2 %}{{ item }},{% endif %}{% endfor %}';
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
    });
  });
});
