/**
 * Filter and function application engine
 */

import type { FilterFunction } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

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
  length: (value: AnyValue): number => {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).length;
    }
    return 0;
  },

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
   * Convert to number
   */
  number: (value: AnyValue): number | null => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const num = Number.parseFloat(value);
      return Number.isNaN(num) ? null : num;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return null;
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
};

/**
 * Filter application engine
 */
export class FilterEngine {
  private filters: Map<string, FilterFunction>;

  constructor(initialFilters?: Record<string, FilterFunction>) {
    this.filters = new Map(Object.entries(BUILTIN_FILTERS));

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
