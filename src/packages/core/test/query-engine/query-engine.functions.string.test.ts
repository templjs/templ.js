import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';
import {
  capitalize as capitalizeStringHandler,
  join as joinStringHandler,
  padEnd as padEndStringHandler,
  padStart as padStartStringHandler,
  slice as sliceStringHandler,
} from '../../src/query-engine/functions/string-functions';

const engine = new QueryEngine();

describe('QueryEngine string functions', () => {
  it('supports WI baseline string functions', () => {
    expect(engine.applyFilter('hello', 'upper', [])).toBe('HELLO');
    expect(engine.applyFilter('HELLO', 'lower', [])).toBe('hello');
    expect(engine.applyFilter('hello', 'capitalize', [])).toBe('Hello');
    expect(engine.applyFilter('  hi  ', 'trim', [])).toBe('hi');
    expect(engine.applyFilter('  hi  ', 'ltrim', [])).toBe('hi  ');
    expect(engine.applyFilter('  hi  ', 'rtrim', [])).toBe('  hi');
    expect(engine.applyFilter('hello world', 'replace', ['world', 'templjs'])).toBe(
      'hello templjs'
    );
    expect(engine.applyFilter('abcdef', 'slice', [1, 4])).toBe('bcd');
    expect(engine.applyFilter('a,b,c', 'split', [','])).toEqual(['a', 'b', 'c']);
    expect(engine.applyFilter(['a', 'b'], 'join', ['|'])).toBe('a|b');
    expect(engine.applyFilter('hello', 'startsWith', ['he'])).toBe(true);
    expect(engine.applyFilter('hello', 'endsWith', ['lo'])).toBe(true);
    expect(engine.applyFilter('hello', 'includes', ['ell'])).toBe(true);
    expect(engine.applyFilter('hello', 'indexOf', ['ll'])).toBe(2);
    expect(engine.applyFilter('5', 'padStart', [3, '0'])).toBe('005');
    expect(engine.applyFilter('5', 'padEnd', [3, '0'])).toBe('500');
    expect(engine.applyFilter('ab', 'repeat', [2])).toBe('abab');
    expect(engine.applyFilter('abc', 'reverse', [])).toBe('cba');
    expect(engine.applyFilter('<tag>', 'escape', [])).toBe('&lt;tag&gt;');
  });

  it('covers handler branches for optional args and join validation', () => {
    expect(capitalizeStringHandler('')).toBe('');
    expect(sliceStringHandler('hello', 1)).toBe('ello');
    expect(padStartStringHandler('5', 3)).toBe('  5');
    expect(padEndStringHandler('5', 3)).toBe('5  ');
    expect(joinStringHandler(['a', 'b'], '|')).toBe('a|b');
    expect(() => joinStringHandler('ab', '|')).toThrow('join expects an array');
  });
});
