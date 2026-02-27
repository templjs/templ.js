import { describe, expect, it } from 'vitest';
import { FilterEngine } from './filter-engine';

describe('FilterEngine', () => {
  describe('built-in filters', () => {
    const engine = new FilterEngine();

    it.each([
      { input: 'hello', expected: 'HELLO' },
      { input: 123, expected: 123 },
    ])('upper filter %#', ({ input, expected }) => {
      expect(engine.applyFilter('upper', input)).toEqual(expected);
    });

    it.each([
      { input: 'HELLO', expected: 'hello' },
      { input: false, expected: false },
    ])('lower filter %#', ({ input, expected }) => {
      expect(engine.applyFilter('lower', input)).toEqual(expected);
    });

    it('capitalizes non-empty strings', () => {
      expect(engine.applyFilter('capitalize', 'hello')).toBe('Hello');
    });

    it('keeps empty strings unchanged in capitalize', () => {
      expect(engine.applyFilter('capitalize', '')).toBe('');
    });

    it('trims strings and leaves non-strings unchanged', () => {
      expect(engine.applyFilter('trim', '  a  ')).toBe('a');
      expect(engine.applyFilter('trim', 3)).toBe(3);
    });

    it('reverses strings and arrays', () => {
      expect(engine.applyFilter('reverse', 'abc')).toBe('cba');
      expect(engine.applyFilter('reverse', [1, 2, 3])).toEqual([3, 2, 1]);
      expect(engine.applyFilter('reverse', { a: 1 })).toEqual({ a: 1 });
    });

    it('gets length for strings, arrays, and objects', () => {
      expect(engine.applyFilter('length', 'abcd')).toBe(4);
      expect(engine.applyFilter('length', [1, 2])).toBe(2);
      expect(engine.applyFilter('length', { a: 1, b: 2 })).toBe(2);
      expect(engine.applyFilter('length', null)).toBe(0);
    });

    it('joins arrays and leaves non-arrays unchanged', () => {
      expect(engine.applyFilter('join', ['a', 'b'], ['|'])).toBe('a|b');
      expect(engine.applyFilter('join', 'a,b', ['|'])).toBe('a,b');
    });

    it('splits strings and leaves non-strings unchanged', () => {
      expect(engine.applyFilter('split', 'a,b,c', [','])).toEqual(['a', 'b', 'c']);
      expect(engine.applyFilter('split', 123, [','])).toBe(123);
    });

    it('replaces substring occurrences when types are valid', () => {
      expect(engine.applyFilter('replace', 'a-b-c', ['-', '+'])).toBe('a+b+c');
      expect(engine.applyFilter('replace', 'abc', [10, 'x'])).toBe('abc');
    });

    it('truncates long strings and keeps short strings', () => {
      expect(engine.applyFilter('truncate', 'abcdefgh', [5])).toBe('abcde...');
      expect(engine.applyFilter('truncate', 'abc', [5])).toBe('abc');
      expect(engine.applyFilter('truncate', 123, [5])).toBe(123);
    });

    it('coerces values with string filter', () => {
      expect(engine.applyFilter('string', null)).toBe('');
      expect(engine.applyFilter('string', undefined)).toBe('');
      expect(engine.applyFilter('string', 12)).toBe('12');
      expect(engine.applyFilter('string', true)).toBe('true');
      expect(engine.applyFilter('string', [1, 'x'])).toBe('1,x');
      expect(engine.applyFilter('string', { a: 1 })).toBe('[object Object]');
    });

    it('coerces values with number filter', () => {
      expect(engine.applyFilter('number', 10)).toBe(10);
      expect(engine.applyFilter('number', '10.5')).toBe(10.5);
      expect(engine.applyFilter('number', 'invalid')).toBeNull();
      expect(engine.applyFilter('number', true)).toBe(1);
      expect(engine.applyFilter('number', false)).toBe(0);
      expect(engine.applyFilter('number', { a: 1 })).toBeNull();
    });

    it('applies default filter only for null/undefined/empty/false', () => {
      expect(engine.applyFilter('default', null, ['fallback'])).toBe('fallback');
      expect(engine.applyFilter('default', undefined, ['fallback'])).toBe('fallback');
      expect(engine.applyFilter('default', '', ['fallback'])).toBe('fallback');
      expect(engine.applyFilter('default', false, ['fallback'])).toBe('fallback');
      expect(engine.applyFilter('default', 0, ['fallback'])).toBe(0);
      expect(engine.applyFilter('default', 'ok', ['fallback'])).toBe('ok');
    });

    it('filters arrays with where filter', () => {
      const value = [{ active: true }, { active: false }, { active: 1 }, null];
      expect(engine.applyFilter('where', value, ['active'])).toEqual([{ active: true }, { active: 1 }]);
      expect(engine.applyFilter('where', value, [10])).toBe(value);
      expect(engine.applyFilter('where', 'no-array', ['active'])).toBe('no-array');
    });

    it('returns first/last element for arrays and strings', () => {
      expect(engine.applyFilter('first', [1, 2, 3])).toBe(1);
      expect(engine.applyFilter('first', 'abc')).toBe('a');
      expect(engine.applyFilter('first', [])).toBeUndefined();
      expect(engine.applyFilter('last', [1, 2, 3])).toBe(3);
      expect(engine.applyFilter('last', 'abc')).toBe('c');
      expect(engine.applyFilter('last', '')).toBeUndefined();
    });

    it('handles abs and round filters', () => {
      expect(engine.applyFilter('abs', -10)).toBe(10);
      expect(engine.applyFilter('abs', 'x')).toBe('x');
      expect(engine.applyFilter('round', 3.14159, [2])).toBe(3.14);
      expect(engine.applyFilter('round', 3.14159)).toBe(3);
      expect(engine.applyFilter('round', 'x', [2])).toBe('x');
    });

    it('json stringifies input', () => {
      expect(engine.applyFilter('json', { a: 1 })).toBe('{"a":1}');
      expect(engine.applyFilter('json', ['a', 1])).toBe('["a",1]');
    });
  });

  describe('engine behavior', () => {
    it('registers and executes custom filters', () => {
      const engine = new FilterEngine();
      engine.registerFilter('double', (value: unknown) => Number(value) * 2);

      expect(engine.applyFilter('double', 4)).toBe(8);
    });

    it('supports constructor-provided filters', () => {
      const engine = new FilterEngine({ bang: (value: unknown) => `${value}!` });
      expect(engine.applyFilter('bang', 'ok')).toBe('ok!');
    });

    it('throws when filter is unknown', () => {
      const engine = new FilterEngine();
      expect(() => engine.applyFilter('missing', 'x')).toThrow('Unknown filter: missing');
    });

    it('wraps downstream filter errors', () => {
      const engine = new FilterEngine({ boom: () => { throw new Error('bad news'); } });
      expect(() => engine.applyFilter('boom', 'x')).toThrow("Filter 'boom' failed: bad news");
    });

    it('handles applyFilter argument dispatch paths', () => {
      const engine = new FilterEngine({
        argCount: (_value: unknown, ...args: unknown[]) => args.length,
      });

      expect(engine.applyFilter('argCount', 'x')).toBe(0);
      expect(engine.applyFilter('argCount', 'x', [1])).toBe(1);
      expect(engine.applyFilter('argCount', 'x', [1, 2])).toBe(2);
      expect(engine.applyFilter('argCount', 'x', [1, 2, 3])).toBe(3);
      expect(engine.applyFilter('argCount', 'x', [1, 2, 3, 4])).toBe(4);
    });

    it('chains filters in order', () => {
      const engine = new FilterEngine();
      const result = engine.chainFilters('  hello  ', [
        { name: 'trim', args: [] },
        { name: 'upper', args: [] },
      ]);

      expect(result).toBe('HELLO');
    });

    it('returns registered filter names', () => {
      const engine = new FilterEngine({ custom: (value: unknown) => value });
      const names = engine.getFilterNames();

      expect(names).toContain('upper');
      expect(names).toContain('custom');
    });
  });
});
