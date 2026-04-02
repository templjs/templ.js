/**
 * Filter and function application engine
 */

import type { FilterFunction } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const HTML_ESCAPE_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const MAX_FORMATTER_CACHE_SIZE = 256;

const NUMBER_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();
const CURRENCY_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();
const MAX_INTL_FRACTION_DIGITS = 20;

function getLruCacheValue(
  cache: Map<string, Intl.NumberFormat>,
  key: string
): Intl.NumberFormat | undefined {
  const value = cache.get(key);
  if (!value) {
    return undefined;
  }

  // Promote accessed entry to most-recently-used position.
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function setLruCacheValue(
  cache: Map<string, Intl.NumberFormat>,
  key: string,
  value: Intl.NumberFormat
) {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);

  if (cache.size > MAX_FORMATTER_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === 'string') {
      cache.delete(oldestKey);
    }
  }
}

function getCachedNumberFormatter(
  locale: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number
): Intl.NumberFormat {
  const cacheKey = `${locale}|${minimumFractionDigits}|${maximumFractionDigits}`;
  const cachedFormatter = getLruCacheValue(NUMBER_FORMATTER_CACHE, cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits,
    maximumFractionDigits,
  });
  setLruCacheValue(NUMBER_FORMATTER_CACHE, cacheKey, formatter);
  return formatter;
}

function getCachedCurrencyFormatter(locale: string, currencyCode: string): Intl.NumberFormat {
  const cacheKey = `${locale}|${currencyCode}`;
  const cachedFormatter = getLruCacheValue(CURRENCY_FORMATTER_CACHE, cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  });
  setLruCacheValue(CURRENCY_FORMATTER_CACHE, cacheKey, formatter);
  return formatter;
}

function getCurrencyFractionDigits(resolvedCurrencyCode: string, resolvedLocale: string): number {
  const localesToTry = [resolvedLocale, 'en-US', undefined] as const;

  for (const locale of localesToTry) {
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: resolvedCurrencyCode,
      });
      return formatter.resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      continue;
    }
  }

  return 2;
}

function toFiniteNumber(value: AnyValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return null;
}

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_PATTERN, (char) => HTML_ESCAPE_ENTITIES[char] ?? char);
}

function getLength(value: AnyValue): number {
  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length;
  }
  return 0;
}

/**
 * Built-in filters for template processing
 */
const BUILTIN_FILTERS: Record<string, FilterFunction> = {
  /**
   * Convert to uppercase
   */
  upper: (value: AnyValue): AnyValue => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  },

  /**
   * Convert to lowercase
   */
  lower: (value: AnyValue): AnyValue => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  },

  /**
   * Capitalize first letter
   */
  capitalize: (value: AnyValue): AnyValue => {
    if (typeof value === 'string' && value.length > 0) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  },

  /**
   * Remove whitespace from both ends
   */
  trim: (value: AnyValue): AnyValue => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  },

  /**
   * Reverse a string or array
   */
  reverse: (value: AnyValue): AnyValue => {
    if (typeof value === 'string') {
      return value.split('').reverse().join('');
    }
    if (Array.isArray(value)) {
      return [...value].reverse();
    }
    return value;
  },

  /**
   * Get length of string or array
   */
  length: (value: AnyValue): number => getLength(value),

  /**
   * Alias for length (string/array/object size)
   */
  size: (value: AnyValue): number => getLength(value),

  /**
   * Join array elements
   */
  join: (value: AnyValue, separator = ','): AnyValue => {
    if (Array.isArray(value)) {
      return value.join(separator);
    }
    return value;
  },

  /**
   * Split string into array
   */
  split: (value: AnyValue, separator = ','): AnyValue => {
    if (typeof value === 'string') {
      return value.split(separator);
    }
    return value;
  },

  /**
   * Replace substring
   */
  replace: (value: AnyValue, search: AnyValue, replacement: AnyValue): AnyValue => {
    if (typeof value === 'string' && typeof search === 'string') {
      return value.replaceAll(search, String(replacement));
    }
    return value;
  },

  /**
   * Truncate string to length
   */
  truncate: (value: AnyValue, length: AnyValue, suffix = '...'): AnyValue => {
    if (typeof value === 'string') {
      const len = typeof length === 'number' ? length : 0;
      if (value.length > len) {
        return value.slice(0, len) + suffix;
      }
    }
    return value;
  },

  /**
   * Convert to string
   */
  string: (value: AnyValue): string => {
    if (value === null) {
      return '';
    }
    if (value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      return value.map((v) => BUILTIN_FILTERS.string(v)).join(',');
    }
    if (typeof value === 'object') {
      return '[object Object]';
    }
    return String(value);
  },

  /**
   * Mark trusted content for raw output without escaping.
   */
  no_escape: (value: AnyValue): AnyValue => value,

  /**
   * Convert to number
   */
  number: function (value: AnyValue, fallback?: AnyValue): number | null | AnyValue {
    const numericValue = toFiniteNumber(value);
    if (numericValue !== null) {
      return numericValue;
    }

    return arguments.length > 1 ? fallback : null;
  },

  /**
   * Locale-aware number formatting using Intl.NumberFormat
   */
  format_number: (
    value: AnyValue,
    locale: AnyValue = 'en-US',
    minimumFractionDigits: AnyValue = 0,
    maximumFractionDigits: AnyValue = minimumFractionDigits
  ): AnyValue => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) {
      return value;
    }

    const resolvedLocale = typeof locale === 'string' && locale.trim() ? locale.trim() : 'en-US';
    const minDigits = Math.min(
      MAX_INTL_FRACTION_DIGITS,
      typeof minimumFractionDigits === 'number' && Number.isFinite(minimumFractionDigits)
        ? Math.max(0, Math.floor(minimumFractionDigits))
        : 0
    );
    const maxDigitsCandidate = Math.min(
      MAX_INTL_FRACTION_DIGITS,
      typeof maximumFractionDigits === 'number' && Number.isFinite(maximumFractionDigits)
        ? Math.max(0, Math.floor(maximumFractionDigits))
        : minDigits
    );
    const maxDigits = Math.max(minDigits, maxDigitsCandidate);

    try {
      return getCachedNumberFormatter(resolvedLocale, minDigits, maxDigits).format(numericValue);
    } catch {
      return getCachedNumberFormatter('en-US', minDigits, maxDigits).format(numericValue);
    }
  },

  /**
   * Locale-aware currency formatting using Intl.NumberFormat
   */
  format_currency: (
    value: AnyValue,
    currencyCode: AnyValue,
    locale: AnyValue = 'en-US'
  ): AnyValue => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) {
      return value;
    }

    if (typeof currencyCode !== 'string') {
      return value;
    }

    const resolvedCurrencyCode = currencyCode.trim().toUpperCase();
    if (!resolvedCurrencyCode) {
      return value;
    }

    const resolvedLocale = typeof locale === 'string' && locale.trim() ? locale.trim() : 'en-US';

    try {
      return getCachedCurrencyFormatter(resolvedLocale, resolvedCurrencyCode).format(numericValue);
    } catch {
      try {
        return getCachedCurrencyFormatter('en-US', resolvedCurrencyCode).format(numericValue);
      } catch {
        const fractionDigits = getCurrencyFractionDigits(resolvedCurrencyCode, resolvedLocale);
        return `${resolvedCurrencyCode} ${numericValue.toFixed(fractionDigits)}`;
      }
    }
  },

  /**
   * Default value if falsy
   */
  default: (value: AnyValue, defaultValue: AnyValue): AnyValue => {
    if (value === null || value === undefined || value === '' || value === false) {
      return defaultValue;
    }
    return value;
  },

  /**
   * Filter array by key
   */
  where: (value: AnyValue, key: AnyValue): AnyValue => {
    if (!Array.isArray(value)) {
      return value;
    }
    if (typeof key !== 'string') {
      return value;
    }
    return value.filter((item: AnyValue) => {
      if (typeof item === 'object' && item !== null) {
        return item[key];
      }
      return false;
    });
  },

  /**
   * Get first element
   */
  first: (value: AnyValue): AnyValue => {
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    if (typeof value === 'string' && value.length > 0) {
      return value.charAt(0);
    }
    return undefined;
  },

  /**
   * Get last element
   */
  last: (value: AnyValue): AnyValue => {
    if (Array.isArray(value) && value.length > 0) {
      return value[value.length - 1];
    }
    if (typeof value === 'string' && value.length > 0) {
      return value.charAt(value.length - 1);
    }
    return undefined;
  },

  /**
   * Get absolute value
   */
  abs: (value: AnyValue): AnyValue => {
    if (typeof value === 'number') {
      return Math.abs(value);
    }
    return value;
  },

  /**
   * Round number
   */
  round: (value: AnyValue, precision = 0): AnyValue => {
    if (typeof value === 'number') {
      const factor = Math.pow(10, precision);
      return Math.round(value * factor) / factor;
    }
    return value;
  },

  /**
   * JSON.stringify
   */
  json: (value: AnyValue): string => {
    return JSON.stringify(value);
  },

  /**
   * Escape HTML-sensitive characters
   */
  escape: (value: AnyValue): AnyValue => {
    if (value === null || value === undefined) {
      return '';
    }
    return escapeHtml(String(value));
  },

  /**
   * Alias for HTML escape
   */
  e: (value: AnyValue): AnyValue => {
    return BUILTIN_FILTERS.escape(value);
  },

  /**
   * JavaScript-like type inspection with null/array handling
   */
  typeof: (value: AnyValue): string => {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    return typeof value;
  },
};

export function getBuiltinFilterNames(): string[] {
  return Object.keys(BUILTIN_FILTERS);
}

export const BUILTIN_FILTER_NAMES = getBuiltinFilterNames();

/**
 * Clears the module-level Intl.NumberFormat caches for number and currency
 * formatters. Call this in long-running or dynamic-locale scenarios to free
 * memory accumulated from many distinct locale/currency combinations.
 */
export function clearFormatterCaches(): void {
  NUMBER_FORMATTER_CACHE.clear();
  CURRENCY_FORMATTER_CACHE.clear();
}

/**
 * Filter application engine
 */
export class FilterEngine {
  private filters = createBuiltinFilterMap();

  constructor(initialFilters?: Record<string, FilterFunction>) {
    if (initialFilters) {
      Object.entries(initialFilters).forEach(([name, fn]) => {
        this.filters.set(name, fn);
      });
    }
  }

  /**
   * Register a filter function
   */
  registerFilter(name: string, fn: FilterFunction): void {
    this.filters.set(name, fn);
  }

  /**
   * Apply a single filter to a value
   */
  applyFilter(name: string, value: AnyValue, args: AnyValue[] = []): AnyValue {
    const filter = this.filters.get(name);
    if (!filter) {
      throw new Error(`Unknown filter: ${name}`);
    }

    try {
      switch (args.length) {
        case 0:
          return filter(value);
        case 1:
          return filter(value, args[0]);
        case 2:
          return filter(value, args[0], args[1]);
        case 3:
          return filter(value, args[0], args[1], args[2]);
        default: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fn = filter as (...params: any[]) => AnyValue;

          return fn(value, ...args);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Filter '${name}' failed: ${message}`, { cause: error });
    }
  }

  /**
   * Apply multiple filters in sequence
   */
  chainFilters(value: AnyValue, filters: Array<{ name: string; args: AnyValue[] }>): AnyValue {
    let result = value;

    for (const filter of filters) {
      result = this.applyFilter(filter.name, result, filter.args);
    }

    return result;
  }

  /**
   * Get all registered filter names
   */
  getFilterNames(): string[] {
    return Array.from(this.filters.keys());
  }
}

export function createBuiltinFilterMap(): Map<string, FilterFunction> {
  return new Map(Object.entries(BUILTIN_FILTERS));
}
