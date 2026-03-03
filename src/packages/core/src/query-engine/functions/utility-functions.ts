/**
 * Utility Functions
 *
 * Cross-category helper functions.
 */

import type { FunctionSignature, FilterFunction } from '../types';

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

export const utilityFunctions = [{ signature: defaultSignature, handler: defaultValue }];
