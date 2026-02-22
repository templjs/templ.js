/**
 * Object Functions (10 functions)
 *
 * Functions for object manipulation including key/value operations,
 * merging, picking, and property access.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FunctionSignature, FilterFunction } from '../types';

// Object function signatures
export const keysSignature: FunctionSignature = {
  name: 'keys',
  category: 'object',
  description: 'Get object keys',
  parameters: [],
  returnType: 'array',
  examples: ['keys({a: 1, b: 2}) → ["a", "b"]'],
};

export const valuesSignature: FunctionSignature = {
  name: 'values',
  category: 'object',
  description: 'Get object values',
  parameters: [],
  returnType: 'array',
  examples: ['values({a: 1, b: 2}) → [1, 2]'],
};

export const entriesSignature: FunctionSignature = {
  name: 'entries',
  category: 'object',
  description: 'Get object entries as [key, value] pairs',
  parameters: [],
  returnType: 'array',
  examples: ['entries({a: 1, b: 2}) → [["a", 1], ["b", 2]]'],
};

export const hasSignature: FunctionSignature = {
  name: 'has',
  category: 'object',
  description: 'Check if object has property',
  parameters: [
    { name: 'key', type: 'string', required: true, description: 'Property key to check' },
  ],
  returnType: 'boolean',
  examples: ['has({a: 1}, "a") → true', 'has({a: 1}, "b") → false'],
};

export const getSignature: FunctionSignature = {
  name: 'get',
  category: 'object',
  description: 'Get object property with optional default',
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'Property path (e.g., "a.b.c")',
    },
    { name: 'defaultValue', type: 'any', required: false, description: 'Default value' },
  ],
  returnType: 'any',
  examples: ['get({a: {b: 1}}, "a.b") → 1', 'get({}, "a", 0) → 0'],
};

export const mergeSignature: FunctionSignature = {
  name: 'merge',
  category: 'object',
  description: 'Merge multiple objects',
  parameters: [
    { name: 'objects', type: 'object', required: true, description: 'Objects to merge' },
  ],
  returnType: 'object',
  examples: ['merge({a: 1}, {b: 2}) → {a: 1, b: 2}'],
};

export const pickSignature: FunctionSignature = {
  name: 'pick',
  category: 'object',
  description: 'Pick specific properties from object',
  parameters: [{ name: 'keys', type: 'array', required: true, description: 'Keys to pick' }],
  returnType: 'object',
  examples: ['pick({a: 1, b: 2, c: 3}, ["a", "c"]) → {a: 1, c: 3}'],
};

export const omitSignature: FunctionSignature = {
  name: 'omit',
  category: 'object',
  description: 'Omit specific properties from object',
  parameters: [{ name: 'keys', type: 'array', required: true, description: 'Keys to omit' }],
  returnType: 'object',
  examples: ['omit({a: 1, b: 2, c: 3}, ["b"]) → {a: 1, c: 3}'],
};

export const assignSignature: FunctionSignature = {
  name: 'assign',
  category: 'object',
  description: 'Assign properties from source to target',
  parameters: [{ name: 'source', type: 'object', required: true, description: 'Source object' }],
  returnType: 'object',
  examples: ['assign({a: 1}, {b: 2}) → {a: 1, b: 2}'],
};

export const isEmptySignature: FunctionSignature = {
  name: 'isEmpty',
  category: 'object',
  description: 'Check if object is empty',
  parameters: [],
  returnType: 'boolean',
  examples: ['isEmpty({}) → true', 'isEmpty({a: 1}) → false'],
};

// Object function handlers
export const keys: FilterFunction = (value: unknown): string[] => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('keys expects an object');
  }
  return Object.keys(value);
};

export const values: FilterFunction = (value: unknown): unknown[] => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('values expects an object');
  }
  return Object.values(value);
};

export const entries: FilterFunction = (value: unknown): Array<[string, unknown]> => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('entries expects an object');
  }
  return Object.entries(value);
};

export const has: FilterFunction = (value: unknown, key: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('has expects an object');
  }
  return Object.prototype.hasOwnProperty.call(value, String(key));
};

export const get: FilterFunction = (
  value: unknown,
  path: unknown,
  defaultValue?: unknown
): unknown => {
  if (typeof value !== 'object' || value === null) {
    return defaultValue;
  }

  const pathStr = String(path);
  const parts = pathStr.split('.');

  let current: any = value;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[part];
  }

  return current !== undefined ? current : defaultValue;
};

export const merge: FilterFunction = (
  value: unknown,
  ...others: unknown[]
): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('merge expects an object');
  }

  let result = { ...(value as any) };

  for (const other of others) {
    if (typeof other === 'object' && other !== null) {
      result = { ...result, ...(other as any) };
    }
  }

  return result;
};

export const pick: FilterFunction = (value: unknown, keys: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('pick expects an object');
  }

  if (!Array.isArray(keys)) {
    throw new Error('pick expects keys to be an array');
  }

  const result: Record<string, unknown> = {};

  const obj = value as any;

  for (const key of keys) {
    const keyStr = String(key);
    if (Object.prototype.hasOwnProperty.call(obj, keyStr)) {
      result[keyStr] = obj[keyStr];
    }
  }

  return result;
};

export const omit: FilterFunction = (value: unknown, keys: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('omit expects an object');
  }

  if (!Array.isArray(keys)) {
    throw new Error('omit expects keys to be an array');
  }

  const keySet = new Set(keys.map(String));
  const result: Record<string, unknown> = {};

  const obj = value as any;

  for (const key of Object.keys(obj)) {
    if (!keySet.has(key)) {
      result[key] = obj[key];
    }
  }

  return result;
};

export const assign: FilterFunction = (
  value: unknown,
  source: unknown
): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('assign expects an object');
  }

  if (typeof source !== 'object' || source === null) {
    throw new Error('assign expects source to be an object');
  }

  return Object.assign({} as any, value as any, source as any);
};

export const isEmpty: FilterFunction = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return Object.keys(value).length === 0;
};

/**
 * Export all object function registrations
 */
export const objectFunctions = [
  { signature: keysSignature, handler: keys },
  { signature: valuesSignature, handler: values },
  { signature: entriesSignature, handler: entries },
  { signature: hasSignature, handler: has },
  { signature: getSignature, handler: get },
  { signature: mergeSignature, handler: merge },
  { signature: pickSignature, handler: pick },
  { signature: omitSignature, handler: omit },
  { signature: assignSignature, handler: assign },
  { signature: isEmptySignature, handler: isEmpty },
];
