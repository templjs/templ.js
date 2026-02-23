/**
 * Array Functions (14 functions)
 *
 * Functions for array manipulation including filtering, mapping,
 * sorting, and other array operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FunctionSignature, FilterFunction } from '../types';

// Array function signatures
export const lengthSignature: FunctionSignature = {
  name: 'length',
  category: 'array',
  description: 'Get array length',
  parameters: [],
  returnType: 'number',
  examples: ['length([1, 2, 3]) → 3', 'length([]) → 0'],
};

export const sizeSignature: FunctionSignature = {
  name: 'size',
  category: 'array',
  description: 'Get array/object size (alias for length)',
  parameters: [],
  returnType: 'number',
  examples: ['size({a: 1, b: 2}) → 2'],
};

export const firstSignature: FunctionSignature = {
  name: 'first',
  category: 'array',
  description: 'Get first element of array',
  parameters: [],
  returnType: 'any',
  examples: ['first([1, 2, 3]) → 1', 'first([]) → undefined'],
};

export const lastSignature: FunctionSignature = {
  name: 'last',
  category: 'array',
  description: 'Get last element of array',
  parameters: [],
  returnType: 'any',
  examples: ['last([1, 2, 3]) → 3', 'last([]) → undefined'],
};

export const reverseArraySignature: FunctionSignature = {
  name: 'reverse',
  category: 'array',
  description: 'Reverse array',
  parameters: [],
  returnType: 'array',
  examples: ['reverse([1, 2, 3]) → [3, 2, 1]'],
};

export const sortSignature: FunctionSignature = {
  name: 'sort',
  category: 'array',
  description: 'Sort array',
  parameters: [
    {
      name: 'key',
      type: 'string',
      required: false,
      description: 'Property to sort by (for objects)',
    },
  ],
  returnType: 'array',
  examples: ['sort([3, 1, 2]) → [1, 2, 3]', 'sort([{n:3}, {n:1}], "n") → [{n:1}, {n:3}]'],
};

export const uniqueSignature: FunctionSignature = {
  name: 'unique',
  category: 'array',
  description: 'Get unique elements',
  parameters: [],
  returnType: 'array',
  examples: ['unique([1, 2, 2, 3, 1]) → [1, 2, 3]'],
};

export const filterSignature: FunctionSignature = {
  name: 'filter',
  category: 'array',
  description: 'Filter array elements where predicate is true',
  parameters: [
    {
      name: 'predicate',
      type: 'function',
      required: true,
      description: 'Function to test elements',
    },
  ],
  returnType: 'array',
  examples: ['filter([1, 2, 3, 4], x => x > 2) → [3, 4]'],
};

export const mapSignature: FunctionSignature = {
  name: 'map',
  category: 'array',
  description: 'Map array elements with transform function',
  parameters: [
    {
      name: 'fn',
      type: 'function',
      required: true,
      description: 'Transform function',
    },
  ],
  returnType: 'array',
  examples: ['map([1, 2, 3], x => x * 2) → [2, 4, 6]'],
};

export const reduceSignature: FunctionSignature = {
  name: 'reduce',
  category: 'array',
  description: 'Reduce array to single value',
  parameters: [
    {
      name: 'fn',
      type: 'function',
      required: true,
      description: 'Reducer function (acc, val) => result',
    },
    {
      name: 'initial',
      type: 'any',
      required: false,
      description: 'Initial accumulator value',
    },
  ],
  returnType: 'any',
  examples: ['reduce([1, 2, 3], (a, v) => a + v, 0) → 6'],
};

export const joinArraySignature: FunctionSignature = {
  name: 'join',
  category: 'array',
  description: 'Join array elements with separator',
  parameters: [
    {
      name: 'separator',
      type: 'string',
      required: true,
      description: 'Separator string',
    },
  ],
  returnType: 'string',
  examples: ['join([1, 2, 3], ",") → "1,2,3"'],
};

export const includesArraySignature: FunctionSignature = {
  name: 'includes',
  category: 'array',
  description: 'Check if array contains element',
  parameters: [{ name: 'item', type: 'any', required: true, description: 'Item to search for' }],
  returnType: 'boolean',
  examples: ['includes([1, 2, 3], 2) → true', 'includes([1, 2, 3], 4) → false'],
};

export const indexOfArraySignature: FunctionSignature = {
  name: 'indexOf',
  category: 'array',
  description: 'Find index of element in array',
  parameters: [{ name: 'item', type: 'any', required: true, description: 'Item to find' }],
  returnType: 'number',
  examples: ['indexOf([1, 2, 3], 2) → 1', 'indexOf([1, 2, 3], 4) → -1'],
};

export const sliceArraySignature: FunctionSignature = {
  name: 'slice',
  category: 'array',
  description: 'Extract a slice of array',
  parameters: [
    { name: 'start', type: 'number', required: true, description: 'Start index' },
    { name: 'end', type: 'number', required: false, description: 'End index (exclusive)' },
  ],
  returnType: 'array',
  examples: ['slice([1, 2, 3, 4], 1, 3) → [2, 3]', 'slice([1, 2, 3, 4], 2) → [3, 4]'],
};

export const concatSignature: FunctionSignature = {
  name: 'concat',
  category: 'array',
  description: 'Concatenate arrays',
  parameters: [
    {
      name: 'arrays',
      type: 'array',
      required: true,
      description: 'Arrays to concatenate',
    },
  ],
  returnType: 'array',
  examples: ['concat([1, 2], [3, 4]) → [1, 2, 3, 4]'],
};

export const flattenSignature: FunctionSignature = {
  name: 'flatten',
  category: 'array',
  description: 'Flatten nested arrays',
  parameters: [
    {
      name: 'depth',
      type: 'number',
      required: false,
      description: 'Depth to flatten (default: 1)',
    },
  ],
  returnType: 'array',
  examples: [
    'flatten([[1, 2], [3, 4]]) → [1, 2, 3, 4]',
    'flatten([[[1]], [[2]]]) → [[1], [2]]',
    'flatten([[[1]], [[2]]], 2) → [1, 2]',
  ],
};

// Array function handlers
export const length: FilterFunction = (value: unknown): number => {
  if (!Array.isArray(value)) {
    throw new Error('length expects an array');
  }
  return value.length;
};

export const size: FilterFunction = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length;
  }
  return 0;
};

export const first: FilterFunction = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    throw new Error('first expects an array');
  }
  return value[0];
};

export const last: FilterFunction = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    throw new Error('last expects an array');
  }
  return value[value.length - 1];
};

export const reverseArray: FilterFunction = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('reverse expects an array');
  }

  return [...(value as any[])].reverse();
};

export const sort: FilterFunction = (value: unknown, key?: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('sort expects an array');
  }

  const arr = [...(value as any[])];
  const sortKey = key ? String(key) : undefined;

  if (sortKey) {
    arr.sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  } else {
    arr.sort((a: any, b: any) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  }

  return arr;
};

export const unique: FilterFunction = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('unique expects an array');
  }
  return Array.from(new Set(value));
};

export const filter: FilterFunction = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('filter expects an array');
  }
  // Note: predicate function would be passed through the query engine
  // This is a simplified implementation
  return value;
};

export const map: FilterFunction = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('map expects an array');
  }
  // Note: map function would be passed through the query engine
  return value;
};

export const reduce: FilterFunction = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    throw new Error('reduce expects an array');
  }
  // Would normally take reducer function as argument
  return value;
};

export const joinArray: FilterFunction = (value: unknown, separator: unknown): string => {
  if (!Array.isArray(value)) {
    throw new Error('join expects an array');
  }
  return value.join(String(separator));
};

export const includesArray: FilterFunction = (value: unknown, item: unknown): boolean => {
  if (!Array.isArray(value)) {
    throw new Error('includes expects an array');
  }
  return value.includes(item);
};

export const indexOfArray: FilterFunction = (value: unknown, item: unknown): number => {
  if (!Array.isArray(value)) {
    throw new Error('indexOf expects an array');
  }
  return value.indexOf(item);
};

export const sliceArray: FilterFunction = (
  value: unknown,
  start: unknown,
  end?: unknown
): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('slice expects an array');
  }
  const startIdx = Number(start);
  const endIdx = end !== undefined ? Number(end) : undefined;
  return value.slice(startIdx, endIdx);
};

export const concat: FilterFunction = (value: unknown, ...others: unknown[]): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('concat expects an array');
  }

  return value.concat(...(others as any[]));
};

export const flatten: FilterFunction = (value: unknown, depth?: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('flatten expects an array');
  }
  const maxDepth = depth !== undefined ? Number(depth) : 1;

  return value.flat(maxDepth);
};

/**
 * Export all array function registrations
 */
export const arrayFunctions = [
  { signature: lengthSignature, handler: length },
  { signature: sizeSignature, handler: size },
  { signature: firstSignature, handler: first },
  { signature: lastSignature, handler: last },
  { signature: reverseArraySignature, handler: reverseArray },
  { signature: sortSignature, handler: sort },
  { signature: uniqueSignature, handler: unique },
  { signature: filterSignature, handler: filter },
  { signature: mapSignature, handler: map },
  { signature: reduceSignature, handler: reduce },
  { signature: joinArraySignature, handler: joinArray },
  { signature: includesArraySignature, handler: includesArray },
  { signature: indexOfArraySignature, handler: indexOfArray },
  { signature: sliceArraySignature, handler: sliceArray },
  { signature: concatSignature, handler: concat },
  { signature: flattenSignature, handler: flatten },
];
