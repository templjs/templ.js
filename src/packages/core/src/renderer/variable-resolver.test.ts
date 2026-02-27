import { describe, expect, it } from 'vitest';
import { VariableResolver } from './variable-resolver';

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  describe('resolve', () => {
    it('resolves direct properties', () => {
      expect(resolver.resolve({ user: 'alice' }, 'user')).toBe('alice');
    });

    it('resolves nested properties', () => {
      expect(resolver.resolve({ user: { profile: { name: 'alice' } } }, 'user.profile.name')).toBe(
        'alice'
      );
    });

    it('resolves array index access', () => {
      expect(resolver.resolve({ items: ['a', 'b', 'c'] }, 'items[1]')).toBe('b');
    });

    it('resolves mixed array and property access', () => {
      const data = { users: [{ info: { name: 'a' } }, { info: { name: 'b' } }] };
      expect(resolver.resolve(data, 'users[1].info.name')).toBe('b');
    });

    it('resolves quoted numeric indexes', () => {
      const data = { items: ['zero', 'one', 'two'] };
      expect(resolver.resolve(data, 'items["2"]')).toBe('two');
      expect(resolver.resolve(data, "items['1']")).toBe('one');
    });

    it('returns undefined for unknown paths', () => {
      expect(resolver.resolve({ user: { name: 'alice' } }, 'user.missing')).toBeUndefined();
    });

    it('returns undefined for invalid indexes', () => {
      expect(resolver.resolve({ items: ['a', 'b'] }, 'items[foo]')).toBeUndefined();
    });

    it('returns undefined for empty path', () => {
      expect(resolver.resolve({ x: 1 }, '')).toBeUndefined();
    });

    it('returns undefined for null or undefined data', () => {
      expect(resolver.resolve(null, 'x')).toBeUndefined();
      expect(resolver.resolve(undefined, 'x')).toBeUndefined();
    });

    it('returns undefined for object key access using string index notation', () => {
      expect(resolver.resolve({ obj: { key: 'value' } }, 'obj["key"]')).toBeUndefined();
    });

    it('handles consecutive dots by skipping empty segments', () => {
      expect(resolver.resolve({ user: { name: 'alice' } }, 'user..name')).toBe('alice');
    });

    it('ignores unmatched bracket content and returns partial resolution', () => {
      expect(resolver.resolve({ items: ['a', 'b'] }, 'items[1')).toEqual(['a', 'b']);
    });

    it('ignores stray closing brackets', () => {
      expect(resolver.resolve({ users: [{ name: 'alice' }] }, 'users]')).toEqual([{ name: 'alice' }]);
    });
  });

  describe('getType', () => {
    it.each([
      { value: null, expected: 'null' },
      { value: undefined, expected: 'undefined' },
      { value: [], expected: 'array' },
      { value: {}, expected: 'object' },
      { value: 'x', expected: 'string' },
      { value: 1, expected: 'number' },
      { value: true, expected: 'boolean' },
    ])('returns $expected for %#', ({ value, expected }) => {
      expect(resolver.getType(value)).toBe(expected);
    });
  });

  describe('isIterable', () => {
    it('returns true for arrays and objects', () => {
      expect(resolver.isIterable([])).toBe(true);
      expect(resolver.isIterable({})).toBe(true);
    });

    it('returns false for primitives and null', () => {
      expect(resolver.isIterable('x')).toBe(false);
      expect(resolver.isIterable(1)).toBe(false);
      expect(resolver.isIterable(false)).toBe(false);
      expect(resolver.isIterable(null)).toBe(false);
    });
  });

  describe('toBoolean', () => {
    it.each([
      { value: null, expected: false },
      { value: undefined, expected: false },
      { value: false, expected: false },
      { value: true, expected: true },
      { value: 0, expected: false },
      { value: 10, expected: true },
      { value: '', expected: false },
      { value: 'x', expected: true },
      { value: [], expected: false },
      { value: [1], expected: true },
      { value: {}, expected: false },
      { value: { ok: true }, expected: true },
    ])('coerces $value to $expected', ({ value, expected }) => {
      expect(resolver.toBoolean(value)).toBe(expected);
    });
  });

  describe('toString', () => {
    it.each([
      { value: null, expected: '' },
      { value: undefined, expected: '' },
      { value: 'text', expected: 'text' },
      { value: 123, expected: '123' },
      { value: true, expected: 'true' },
      { value: false, expected: 'false' },
      { value: [1, 2, 3], expected: '1,2,3' },
      { value: ['a', 'b'], expected: 'a,b' },
    ])('stringifies known value %#', ({ value, expected }) => {
      expect(resolver.toString(value)).toBe(expected);
    });

    it('stringifies nested arrays recursively', () => {
      expect(resolver.toString(['a', ['b', 'c']])).toBe('a,b,c');
    });

    it('returns [object Object] for plain objects', () => {
      expect(resolver.toString({ a: 1 })).toBe('[object Object]');
    });

    it('falls back to String() for uncommon primitives', () => {
      expect(resolver.toString(Symbol.for('x'))).toBe('Symbol(x)');
      expect(resolver.toString(10n)).toBe('10');
    });
  });
});
