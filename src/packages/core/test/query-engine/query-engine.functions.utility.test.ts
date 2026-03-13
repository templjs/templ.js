import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';
import {
  jsonFunction,
  numberFunction,
  stringFunction,
  typeofFunction,
} from '../../src/query-engine/functions/utility-functions.js';

const engine = new QueryEngine();

describe('QueryEngine utility functions', () => {
  it('supports default fallback behavior', () => {
    expect(engine.applyFilter(undefined, 'default', ['fallback'])).toBe('fallback');
    expect(engine.applyFilter(null, 'default', ['fallback'])).toBe('fallback');
    expect(engine.applyFilter('', 'default', ['fallback'])).toBe('fallback');
    expect(engine.applyFilter(false, 'default', ['fallback'])).toBe(false);
    expect(engine.applyFilter('value', 'default', ['fallback'])).toBe('value');
  });

  it('returns type labels for primitives and structured values', () => {
    expect(typeofFunction(null)).toBe('null');
    expect(typeofFunction([1, 2, 3])).toBe('array');
    expect(typeofFunction({ a: 1 })).toBe('object');
    expect(typeofFunction('hello')).toBe('string');
    expect(typeofFunction(42)).toBe('number');
    expect(typeofFunction(false)).toBe('boolean');
    expect(typeofFunction(undefined)).toBe('undefined');
  });

  it('converts values to string consistently', () => {
    expect(stringFunction(' keep spacing ')).toBe(' keep spacing ');
    expect(stringFunction(123)).toBe('123');
    expect(stringFunction(true)).toBe('true');
    expect(stringFunction(null)).toBe('');
    expect(stringFunction(undefined)).toBe('');
    expect(stringFunction(['a', 2, false, null])).toBe('a,2,false,');
    expect(stringFunction({ a: 1 })).toBe('[object Object]');
  });

  it('parses only valid full numeric strings and preserves boolean mapping', () => {
    expect(numberFunction(123)).toBe(123);
    expect(numberFunction('42')).toBe(42);
    expect(numberFunction('  42.5  ')).toBe(42.5);
    expect(numberFunction('-1.2e3')).toBe(-1200);
    expect(numberFunction('123abc')).toBeNull();
    expect(numberFunction('')).toBeNull();
    expect(numberFunction('   ')).toBeNull();
    expect(numberFunction('abc')).toBeNull();
    expect(numberFunction(true)).toBe(1);
    expect(numberFunction(false)).toBe(0);
    expect(numberFunction({})).toBeNull();
  });

  it('serializes JSON safely for bigint, circular refs, and unserializable values', () => {
    expect(jsonFunction({ a: 1 })).toBe('{"a":1}');
    expect(jsonFunction({ id: 123n })).toBe('{"id":"123"}');

    const circular: { self?: unknown; a: number } = { a: 1 };
    circular.self = circular;
    expect(jsonFunction(circular)).toContain('"[Circular]"');

    const unserializable = {
      toJSON() {
        throw new Error('boom');
      },
    };
    expect(jsonFunction(unserializable)).toBe('"[unserializable]"');
  });
});
