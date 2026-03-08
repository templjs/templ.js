import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';
import {
  assign as assignObjectHandler,
  merge as mergeObjectHandler,
  objectLength as objectLengthHandler,
  omit as omitObjectHandler,
  pick as pickObjectHandler,
} from '../../src/query-engine/functions/object-functions.js';

const engine = new QueryEngine();

describe('QueryEngine object functions', () => {
  it('supports WI baseline object functions', () => {
    const input = { a: 1, b: 2, c: 3 };
    expect(engine.applyFilter(input, 'keys', [])).toEqual(['a', 'b', 'c']);
    expect(engine.applyFilter(input, 'values', [])).toEqual([1, 2, 3]);
    expect(engine.applyFilter(input, 'entries', [])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(engine.applyFilter(input, 'has', ['b'])).toBe(true);
    expect(engine.applyFilter({ a: { b: 1 } }, 'get', ['a.b'])).toBe(1);
    expect(engine.applyFilter({ a: 1 }, 'merge', [{ b: 2 }])).toEqual({ a: 1, b: 2 });
    expect(engine.applyFilter(input, 'pick', [['a', 'c']])).toEqual({ a: 1, c: 3 });
    expect(engine.applyFilter(input, 'omit', [['b']])).toEqual({ a: 1, c: 3 });
    expect(engine.applyFilter(input, 'length', [])).toBe(3);
  });

  it('keeps extended object helpers', () => {
    expect(engine.applyFilter({ a: 1 }, 'assign', [{ b: 2 }])).toEqual({ a: 1, b: 2 });
    expect(engine.applyFilter({}, 'isEmpty', [])).toBe(true);
  });

  it('covers get default-value paths and merge non-object skipping', () => {
    expect(engine.applyFilter(null, 'get', ['a.b', 'fallback'])).toBe('fallback');
    expect(engine.applyFilter({ a: null }, 'get', ['a.b', 'fallback'])).toBe('fallback');
    expect(engine.applyFilter({ a: {} }, 'get', ['a.b', 'fallback'])).toBe('fallback');
    expect(mergeObjectHandler({ a: 1 }, { b: 2 }, null, 'skip')).toEqual({ a: 1, b: 2 });
  });

  it('throws object-type errors for strict object handlers', () => {
    const cases: Array<[string, unknown[]]> = [
      ['keys', []],
      ['values', []],
      ['entries', []],
      ['has', ['key']],
      ['merge', [{ b: 2 }]],
      ['pick', [['a']]],
      ['omit', [['a']]],
      ['assign', [{ b: 2 }]],
    ];

    for (const [name, args] of cases) {
      expect(() => engine.applyFilter('not-object', name, args)).toThrow('expects an object');
    }
  });

  it('covers raw-handler argument validation branches', () => {
    expect(() => pickObjectHandler({ a: 1 }, 'a' as unknown as string[])).toThrow(
      'pick expects keys to be an array'
    );
    expect(() => omitObjectHandler({ a: 1 }, 'a' as unknown as string[])).toThrow(
      'omit expects keys to be an array'
    );
    expect(() => assignObjectHandler({ a: 1 }, null)).toThrow(
      'assign expects source to be an object'
    );
    expect(() => objectLengthHandler('not-object')).toThrow('length expects an object');
  });

  it('covers isEmpty non-object and array branches', () => {
    expect(engine.applyFilter(null, 'isEmpty', [])).toBe(true);
    expect(engine.applyFilter([], 'isEmpty', [])).toBe(true);
    expect(engine.applyFilter([1], 'isEmpty', [])).toBe(false);
    expect(engine.applyFilter({ a: 1 }, 'isEmpty', [])).toBe(false);
  });
});
