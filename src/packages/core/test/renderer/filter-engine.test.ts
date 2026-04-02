import { describe, expect, it } from 'vitest';
import { clearFormatterCaches, FilterEngine } from '../../src/renderer/filter-engine.js';

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

    it('supports size alias for strings, arrays, and objects', () => {
      expect(engine.applyFilter('size', [1, 2, 3])).toBe(3);
      expect(engine.applyFilter('size', { a: 1, b: 2 })).toBe(2);
      expect(engine.applyFilter('size', 'abc')).toBe(3);
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

    it('passes through trusted content with no_escape', () => {
      const html = '<strong>Trusted</strong>';
      expect(engine.applyFilter('no_escape', html)).toBe(html);
      expect(engine.applyFilter('no_escape', { html })).toEqual({ html });
    });

    it('coerces values with number filter', () => {
      expect(engine.applyFilter('number', 10)).toBe(10);
      expect(engine.applyFilter('number', Number.POSITIVE_INFINITY)).toBeNull();
      expect(engine.applyFilter('number', '10.5')).toBe(10.5);
      expect(engine.applyFilter('number', '   ')).toBeNull();
      expect(engine.applyFilter('number', 'invalid')).toBeNull();
      expect(engine.applyFilter('number', true)).toBe(1);
      expect(engine.applyFilter('number', false)).toBe(0);
      expect(engine.applyFilter('number', { a: 1 })).toBeNull();
    });

    it('supports an optional fallback for number coercion failures', () => {
      expect(engine.applyFilter('number', 'invalid', [0])).toBe(0);
      expect(engine.applyFilter('number', '   ', [0])).toBe(0);
      expect(engine.applyFilter('number', Number.POSITIVE_INFINITY, [7])).toBe(7);
      expect(engine.applyFilter('number', false, [7])).toBe(0);
      expect(engine.applyFilter('number', 0, [7])).toBe(0);
      expect(engine.applyFilter('number', '10.5', [0])).toBe(10.5);
      expect(engine.applyFilter('number', { a: 1 }, [undefined])).toBeUndefined();
    });

    it('falls back to String(value) for non-object, non-array unknown string coercions', () => {
      expect(engine.applyFilter('string', Symbol.for('templjs'))).toBe('Symbol(templjs)');
      expect(engine.applyFilter('string', false)).toBe('false');
    });

    it('format_number caches formatters', () => {
      clearFormatterCaches();

      const numberFormatted = engine.applyFilter('format_number', 1234.567, ['en-US', 2, 2]);
      expect(typeof numberFormatted).toBe('string');
      expect(numberFormatted).toContain('1,234');

      // Repeated call exercises formatter cache retrieval path.
      const numberFormattedAgain = engine.applyFilter('format_number', 1234.567, ['en-US', 2, 2]);
      expect(numberFormattedAgain).toBe(numberFormatted);
    });

    it('format_number returns invalid input unchanged', () => {
      expect(engine.applyFilter('format_number', 'not-a-number', ['en-US', 2, 2])).toBe(
        'not-a-number'
      );
    });

    it('format_currency caches formatters', () => {
      clearFormatterCaches();

      const currencyFormatted = engine.applyFilter('format_currency', 25, ['USD', 'en-US']);
      expect(typeof currencyFormatted).toBe('string');
      expect(currencyFormatted).toContain('25');

      // Repeated call exercises currency formatter cache retrieval path.
      const currencyFormattedAgain = engine.applyFilter('format_currency', 25, ['USD', 'en-US']);
      expect(currencyFormattedAgain).toBe(currencyFormatted);
    });

    it('format_currency returns invalid inputs unchanged', () => {
      expect(engine.applyFilter('format_currency', 'bad-value', ['USD', 'en-US'])).toBe(
        'bad-value'
      );
      expect(engine.applyFilter('format_currency', 25, [123, 'en-US'])).toBe(25);
      expect(engine.applyFilter('format_currency', 25, ['   ', 'en-US'])).toBe(25);
      expect(engine.applyFilter('format_currency', 25, ['USD', '   '])).toContain('25');
    });

    it('format_number handles empty locale and invalid digit params', () => {
      expect(engine.applyFilter('format_number', 12.3, ['', 'x', 'y'])).toBe('12');
    });

    it('format_number clamps fraction digit arguments to Intl-safe bounds', () => {
      const expected = new Intl.NumberFormat('en-US', {
        useGrouping: true,
        minimumFractionDigits: 20,
        maximumFractionDigits: 20,
      }).format(12.3);

      expect(engine.applyFilter('format_number', 12.3, ['en-US', 25, 25])).toBe(expected);
    });

    it('falls back to en-US when locale-specific number formatting throws', () => {
      const originalNumberFormat = Intl.NumberFormat;
      clearFormatterCaches();

      try {
        Intl.NumberFormat = function NumberFormat(
          this: Intl.NumberFormat,
          locale?: string | string[],
          options?: Intl.NumberFormatOptions
        ) {
          const localeValue = Array.isArray(locale) ? locale[0] : locale;
          if (localeValue !== 'en-US') {
            throw new Error('locale init failed');
          }
          return new originalNumberFormat('en-US', options);
        } as unknown as typeof Intl.NumberFormat;

        const fallback = engine.applyFilter('format_number', 1234.5, ['fr-FR', 1, 1]);
        expect(String(fallback)).toContain('1,234.5');
      } finally {
        Intl.NumberFormat = originalNumberFormat;
        clearFormatterCaches();
      }
    });

    it('evicts oldest cached number formatters when cache exceeds LRU size', () => {
      clearFormatterCaches();

      const locales = [
        'en-US',
        'de-DE',
        'fr-FR',
        'es-ES',
        'it-IT',
        'pt-BR',
        'nl-NL',
        'sv-SE',
        'ja-JP',
        'ko-KR',
        'zh-CN',
        'zh-TW',
        'pl-PL',
      ];

      for (const locale of locales) {
        for (let minDigits = 0; minDigits <= 20; minDigits++) {
          engine.applyFilter('format_number', 1234.5, [locale, minDigits, minDigits]);
        }
      }

      // Re-accessing the oldest key would throw if formatter cache state were corrupted.
      expect(engine.applyFilter('format_number', 1234.5, ['en-US', 0, 0])).toBe('1,235');
    });

    it('replaces an existing cache key when formatter lookup reports a miss', () => {
      clearFormatterCaches();
      expect(engine.applyFilter('format_number', 10, ['en-US', 0, 0])).toBe('10');

      const originalMapGet = Map.prototype.get;
      try {
        Map.prototype.get = function patchedGet(this: Map<unknown, unknown>, key: unknown) {
          if (typeof key === 'string' && key === 'en-US|0|0') {
            return undefined;
          }
          return originalMapGet.call(this, key);
        };

        expect(engine.applyFilter('format_number', 10, ['en-US', 0, 0])).toBe('10');
      } finally {
        Map.prototype.get = originalMapGet;
        clearFormatterCaches();
      }
    });

    it('falls back to USD-like plain formatting when Intl currency formatting throws', () => {
      const originalNumberFormat = Intl.NumberFormat;
      clearFormatterCaches();

      try {
        Intl.NumberFormat = function NumberFormat(this: Intl.NumberFormat) {
          throw new Error('Intl unavailable');
        } as unknown as typeof Intl.NumberFormat;

        const fallback = engine.applyFilter('format_currency', 25, ['USD', 'en-US']);
        expect(fallback).toBe('USD 25.00');
      } finally {
        Intl.NumberFormat = originalNumberFormat;
        clearFormatterCaches();
      }
    });

    it('uses two decimal places when fallback fraction digits are unavailable', () => {
      const originalNumberFormat = Intl.NumberFormat;
      clearFormatterCaches();

      try {
        Intl.NumberFormat = function NumberFormat(
          this: Intl.NumberFormat,
          locale?: string | string[],
          _options?: Intl.NumberFormatOptions
        ) {
          const localeValue = Array.isArray(locale) ? locale[0] : locale;
          if (localeValue === undefined) {
            return {
              resolvedOptions: () => ({}),
              format: () => '$0.00',
            } as unknown as Intl.NumberFormat;
          }
          throw new Error('currency formatter unavailable');
        } as unknown as typeof Intl.NumberFormat;

        const fallback = engine.applyFilter('format_currency', 12.3, ['USD', 'fr-FR']);
        expect(fallback).toBe('USD 12.30');
      } finally {
        Intl.NumberFormat = originalNumberFormat;
        clearFormatterCaches();
      }
    });

    it('escapes HTML values and supports the e alias', () => {
      expect(engine.applyFilter('escape', '<div>"x" & y</div>')).toBe(
        '&lt;div&gt;&quot;x&quot; &amp; y&lt;/div&gt;'
      );
      expect(engine.applyFilter('escape', null)).toBe('');
      expect(engine.applyFilter('e', '<span>ok</span>')).toBe('&lt;span&gt;ok&lt;/span&gt;');
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
      expect(engine.applyFilter('where', value, ['active'])).toEqual([
        { active: true },
        { active: 1 },
      ]);
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

    it('returns normalized typeof values', () => {
      expect(engine.applyFilter('typeof', 1)).toBe('number');
      expect(engine.applyFilter('typeof', 'x')).toBe('string');
      expect(engine.applyFilter('typeof', null)).toBe('null');
      expect(engine.applyFilter('typeof', [1, 2])).toBe('array');
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
      const engine = new FilterEngine({
        boom: () => {
          throw new Error('bad news');
        },
      });
      expect(() => engine.applyFilter('boom', 'x')).toThrow("Filter 'boom' failed: bad news");
    });

    it('wraps non-Error thrown values from filters', () => {
      const engine = new FilterEngine({
        boom: () => {
          throw 'bad string';
        },
      });
      expect(() => engine.applyFilter('boom', 'x')).toThrow("Filter 'boom' failed: bad string");
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
