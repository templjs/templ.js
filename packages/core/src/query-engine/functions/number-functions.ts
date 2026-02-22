/**
 * Number Functions (15 functions)
 *
 * Functions for numeric manipulation including rounding, absolute value,
 * trigonometric functions, and other mathematical operations.
 */

import type { FunctionSignature, FilterFunction } from '../types';

// Number function signatures
export const roundSignature: FunctionSignature = {
  name: 'round',
  category: 'number',
  description: 'Round number to given decimal places',
  parameters: [
    {
      name: 'decimals',
      type: 'number',
      required: false,
      description: 'Number of decimal places (default: 0)',
    },
  ],
  returnType: 'number',
  examples: ['round(3.14159, 2) → 3.14', 'round(3.7) → 4'],
};

export const floorSignature: FunctionSignature = {
  name: 'floor',
  category: 'number',
  description: 'Round number down to nearest integer',
  parameters: [],
  returnType: 'number',
  examples: ['floor(3.7) → 3', 'floor(-3.2) → -4'],
};

export const ceilSignature: FunctionSignature = {
  name: 'ceil',
  category: 'number',
  description: 'Round number up to nearest integer',
  parameters: [],
  returnType: 'number',
  examples: ['ceil(3.2) → 4', 'ceil(-3.7) → -3'],
};

export const absSignature: FunctionSignature = {
  name: 'abs',
  category: 'number',
  description: 'Get absolute value',
  parameters: [],
  returnType: 'number',
  examples: ['abs(-5) → 5', 'abs(3.14) → 3.14'],
};

export const minSignature: FunctionSignature = {
  name: 'min',
  category: 'number',
  description: 'Find minimum value',
  parameters: [
    { name: 'numbers', type: 'array|number', required: true, description: 'Numbers to compare' },
  ],
  returnType: 'number',
  examples: ['min(5, 2, 8) → 2', 'min([5, 2, 8]) → 2'],
};

export const maxSignature: FunctionSignature = {
  name: 'max',
  category: 'number',
  description: 'Find maximum value',
  parameters: [
    { name: 'numbers', type: 'array|number', required: true, description: 'Numbers to compare' },
  ],
  returnType: 'number',
  examples: ['max(5, 2, 8) → 8', 'max([5, 2, 8]) → 8'],
};

export const clampSignature: FunctionSignature = {
  name: 'clamp',
  category: 'number',
  description: 'Clamp number between min and max',
  parameters: [
    { name: 'min', type: 'number', required: true, description: 'Minimum value' },
    { name: 'max', type: 'number', required: true, description: 'Maximum value' },
  ],
  returnType: 'number',
  examples: ['clamp(5, 1, 3) → 3', 'clamp(0, 1, 3) → 1', 'clamp(2, 1, 3) → 2'],
};

export const sqrtSignature: FunctionSignature = {
  name: 'sqrt',
  category: 'number',
  description: 'Square root',
  parameters: [],
  returnType: 'number',
  examples: ['sqrt(16) → 4', 'sqrt(2) → 1.414...'],
};

export const powSignature: FunctionSignature = {
  name: 'pow',
  category: 'number',
  description: 'Raise to power',
  parameters: [{ name: 'exponent', type: 'number', required: true, description: 'Exponent' }],
  returnType: 'number',
  examples: ['pow(2, 3) → 8', 'pow(5, 2) → 25'],
};

export const signSignature: FunctionSignature = {
  name: 'sign',
  category: 'number',
  description: 'Get sign of number (-1, 0, or 1)',
  parameters: [],
  returnType: 'number',
  examples: ['sign(-5) → -1', 'sign(0) → 0', 'sign(3) → 1'],
};

export const toFixedSignature: FunctionSignature = {
  name: 'toFixed',
  category: 'number',
  description: 'Format number with fixed decimal places',
  parameters: [
    {
      name: 'decimals',
      type: 'number',
      required: false,
      description: 'Number of decimal places',
    },
  ],
  returnType: 'string',
  examples: ['toFixed(3.14159, 2) → "3.14"', 'toFixed(42, 2) → "42.00"'],
};

export const parseIntSignature: FunctionSignature = {
  name: 'parseInt',
  category: 'number',
  description: 'Parse string to integer',
  parameters: [
    { name: 'radix', type: 'number', required: false, description: 'Base (default: 10)' },
  ],
  returnType: 'number',
  examples: ['parseInt("42") → 42', 'parseInt("101", 2) → 5'],
};

export const parseFloatSignature: FunctionSignature = {
  name: 'parseFloat',
  category: 'number',
  description: 'Parse string to floating point number',
  parameters: [],
  returnType: 'number',
  examples: ['parseFloat("3.14") → 3.14', 'parseFloat("42") → 42'],
};

export const isNaNSignature: FunctionSignature = {
  name: 'isNaN',
  category: 'number',
  description: 'Check if value is NaN',
  parameters: [],
  returnType: 'boolean',
  examples: ['isNaN(NaN) → true', 'isNaN(42) → false', 'isNaN("hello") → true'],
};

export const isFiniteSignature: FunctionSignature = {
  name: 'isFinite',
  category: 'number',
  description: 'Check if value is finite',
  parameters: [],
  returnType: 'boolean',
  examples: ['isFinite(42) → true', 'isFinite(Infinity) → false', 'isFinite(NaN) → false'],
};

// Number function handlers
export const round: FilterFunction = (value: unknown, decimals?: unknown): number => {
  const num = Number(value);
  const places = decimals !== undefined ? Number(decimals) : 0;
  const factor = Math.pow(10, places);
  return Math.round(num * factor) / factor;
};

export const floor: FilterFunction = (value: unknown): number => {
  return Math.floor(Number(value));
};

export const ceil: FilterFunction = (value: unknown): number => {
  return Math.ceil(Number(value));
};

export const abs: FilterFunction = (value: unknown): number => {
  return Math.abs(Number(value));
};

export const min: FilterFunction = (value: unknown, ...rest: unknown[]): number => {
  if (Array.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.min(...value.map((v: any) => Number(v)));
  }
  return Math.min(Number(value), ...rest.map(Number));
};

export const max: FilterFunction = (value: unknown, ...rest: unknown[]): number => {
  if (Array.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.max(...value.map((v: any) => Number(v)));
  }
  return Math.max(Number(value), ...rest.map(Number));
};

export const clamp: FilterFunction = (value: unknown, minVal: unknown, maxVal: unknown): number => {
  const num = Number(value);
  const min = Number(minVal);
  const max = Number(maxVal);
  return Math.min(Math.max(num, min), max);
};

export const sqrt: FilterFunction = (value: unknown): number => {
  return Math.sqrt(Number(value));
};

export const pow: FilterFunction = (value: unknown, exponent: unknown): number => {
  return Math.pow(Number(value), Number(exponent));
};

export const sign: FilterFunction = (value: unknown): number => {
  return Math.sign(Number(value));
};

export const toFixed: FilterFunction = (value: unknown, decimals?: unknown): string => {
  const num = Number(value);
  const places = decimals !== undefined ? Number(decimals) : 0;
  return num.toFixed(places);
};

export const parseInt: FilterFunction = (value: unknown, radix?: unknown): number => {
  const base = radix !== undefined ? Number(radix) : 10;
  return globalThis.parseInt(String(value), base);
};

export const parseFloat: FilterFunction = (value: unknown): number => {
  return globalThis.parseFloat(String(value));
};

export const isNaN: FilterFunction = (value: unknown): boolean => {
  return Number.isNaN(Number(value));
};

export const isFinite: FilterFunction = (value: unknown): boolean => {
  return Number.isFinite(Number(value));
};

/**
 * Export all number function registrations
 */
export const numberFunctions = [
  { signature: roundSignature, handler: round },
  { signature: floorSignature, handler: floor },
  { signature: ceilSignature, handler: ceil },
  { signature: absSignature, handler: abs },
  { signature: minSignature, handler: min },
  { signature: maxSignature, handler: max },
  { signature: clampSignature, handler: clamp },
  { signature: sqrtSignature, handler: sqrt },
  { signature: powSignature, handler: pow },
  { signature: signSignature, handler: sign },
  { signature: toFixedSignature, handler: toFixed },
  { signature: parseIntSignature, handler: parseInt },
  { signature: parseFloatSignature, handler: parseFloat },
  { signature: isNaNSignature, handler: isNaN },
  { signature: isFiniteSignature, handler: isFinite },
];
