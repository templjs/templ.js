/**
 * Utility Functions
 *
 * Cross-category helper functions.
 */

import type { FunctionSignature, FilterFunction } from '../types.js';

export const defaultSignature: FunctionSignature = {
  name: 'default',
  category: 'utility',
  description: 'Return fallback value when input is null, undefined, or empty string',
  parameters: [{ name: 'fallback', type: 'any', required: true, description: 'Fallback value' }],
  returnType: 'any',
  examples: ['default(null, "Guest") → "Guest"', 'default("Alice", "Guest") → "Alice"'],
};

export const defaultValue: FilterFunction = (value: unknown, fallback: unknown): unknown => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return value;
};

export const typeofSignature: FunctionSignature = {
  name: 'typeof',
  category: 'utility',
  description: 'Return type of the value as a string',
  parameters: [],
  returnType: 'string',
  examples: ['typeof(123) → "number"', 'typeof("hello") → "string"', 'typeof(null) → "null"'],
};

export const typeofFunction: FilterFunction = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
};

export const utilityFunctions = [
  { signature: defaultSignature, handler: defaultValue },
  { signature: typeofSignature, handler: typeofFunction },
];
