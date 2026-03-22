import { describe, expect, it } from 'vitest';
import {
  defaultValue,
  jsonFunction,
  numberFunction,
  stringFunction,
  typeofFunction,
} from '../../src/query-engine/functions/utility-functions.js';

describe('QueryEngine utility functions', () => {
  it('covers defaultValue and typeofFunction branches', () => {
    expect(defaultValue(null, 'fallback')).toBe('fallback');
    expect(defaultValue(undefined, 'fallback')).toBe('fallback');
    expect(defaultValue('', 'fallback')).toBe('fallback');
    expect(defaultValue(0, 'fallback')).toBe(0);

    expect(typeofFunction(null)).toBe('null');
    expect(typeofFunction(['a'])).toBe('array');
    expect(typeofFunction({ ok: true })).toBe('object');
  });

  it('covers stringFunction coercion branches', () => {
    expect(stringFunction(null)).toBe('');
    expect(stringFunction(undefined)).toBe('');
    expect(stringFunction('value')).toBe('value');
    expect(stringFunction(42)).toBe('42');
    expect(stringFunction(false)).toBe('false');
    expect(stringFunction(['a', 1, true])).toBe('a,1,true');
    expect(stringFunction({ ok: true })).toBe('[object Object]');
    expect(stringFunction(Symbol.for('templjs'))).toBe('Symbol(templjs)');
  });

  it('covers numberFunction coercion branches', () => {
    expect(numberFunction(42)).toBe(42);
    expect(numberFunction(' 42 ')).toBe(42);
    expect(numberFunction('   ')).toBeNull();
    expect(numberFunction('not-a-number')).toBeNull();
    expect(numberFunction(true)).toBe(1);
    expect(numberFunction(false)).toBe(0);
    expect(numberFunction({})).toBeNull();
  });

  it('covers jsonFunction bigint, circular, and fallback branches', () => {
    expect(jsonFunction({ big: 10n })).toBe('{"big":"10"}');

    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;
    expect(jsonFunction(circular)).toContain('[Circular]');

    const throwing = {
      toJSON() {
        throw new Error('boom');
      },
    };
    expect(jsonFunction(throwing)).toBe('"[unserializable]"');
  });
});
