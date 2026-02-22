/**
 * String Functions (19 functions)
 *
 * Functions for string manipulation including case transformations,
 * trimming, searching, and pattern matching.
 */

import type { FunctionSignature, FilterFunction } from '../types';

// String function signatures
export const upperSignature: FunctionSignature = {
  name: 'upper',
  category: 'string',
  description: 'Convert string to uppercase',
  parameters: [],
  returnType: 'string',
  examples: ['upper("hello") → "HELLO"'],
};

export const lowerSignature: FunctionSignature = {
  name: 'lower',
  category: 'string',
  description: 'Convert string to lowercase',
  parameters: [],
  returnType: 'string',
  examples: ['lower("HELLO") → "hello"'],
};

export const capitalizeSignature: FunctionSignature = {
  name: 'capitalize',
  category: 'string',
  description: 'Capitalize first letter of string',
  parameters: [],
  returnType: 'string',
  examples: ['capitalize("hello") → "Hello"'],
};

export const trimSignature: FunctionSignature = {
  name: 'trim',
  category: 'string',
  description: 'Remove whitespace from both ends',
  parameters: [],
  returnType: 'string',
  examples: ['trim("  hello  ") → "hello"'],
};

export const ltrimSignature: FunctionSignature = {
  name: 'ltrim',
  category: 'string',
  description: 'Remove whitespace from left side',
  parameters: [],
  returnType: 'string',
  examples: ['ltrim("  hello  ") → "hello  "'],
};

export const rtrimSignature: FunctionSignature = {
  name: 'rtrim',
  category: 'string',
  description: 'Remove whitespace from right side',
  parameters: [],
  returnType: 'string',
  examples: ['rtrim("  hello  ") → "  hello"'],
};

export const replaceSignature: FunctionSignature = {
  name: 'replace',
  category: 'string',
  description: 'Replace all occurrences of search string with replacement',
  parameters: [
    { name: 'search', type: 'string', required: true, description: 'String to search for' },
    {
      name: 'replacement',
      type: 'string',
      required: true,
      description: 'Replacement string',
    },
  ],
  returnType: 'string',
  examples: ['replace("hello world", "world", "there") → "hello there"'],
};

export const sliceSignature: FunctionSignature = {
  name: 'slice',
  category: 'string',
  description: 'Extract a substring',
  parameters: [
    { name: 'start', type: 'number', required: true, description: 'Start index' },
    { name: 'end', type: 'number', required: false, description: 'End index (exclusive)' },
  ],
  returnType: 'string',
  examples: ['slice("hello", 0, 3) → "hel"', 'slice("hello", 1) → "ello"'],
};

export const splitSignature: FunctionSignature = {
  name: 'split',
  category: 'string',
  description: 'Split string by delimiter',
  parameters: [
    {
      name: 'delimiter',
      type: 'string',
      required: true,
      description: 'Delimiter to split on',
    },
  ],
  returnType: 'array',
  examples: ['split("a,b,c", ",") → ["a", "b", "c"]'],
};

export const joinSignature: FunctionSignature = {
  name: 'join',
  category: 'string',
  description: 'Join array elements with separator',
  parameters: [
    {
      name: 'separator',
      type: 'string',
      required: true,
      description: 'String to join with',
    },
  ],
  returnType: 'string',
  examples: ['join(["a", "b", "c"], ",") → "a,b,c"'],
};

export const startsWithSignature: FunctionSignature = {
  name: 'startsWith',
  category: 'string',
  description: 'Check if string starts with prefix',
  parameters: [{ name: 'prefix', type: 'string', required: true, description: 'Prefix to check' }],
  returnType: 'boolean',
  examples: ['startsWith("hello", "he") → true', 'startsWith("hello", "lo") → false'],
};

export const endsWithSignature: FunctionSignature = {
  name: 'endsWith',
  category: 'string',
  description: 'Check if string ends with suffix',
  parameters: [{ name: 'suffix', type: 'string', required: true, description: 'Suffix to check' }],
  returnType: 'boolean',
  examples: ['endsWith("hello", "lo") → true', 'endsWith("hello", "he") → false'],
};

export const includesSignature: FunctionSignature = {
  name: 'includes',
  category: 'string',
  description: 'Check if string contains substring',
  parameters: [
    { name: 'substring', type: 'string', required: true, description: 'Substring to find' },
  ],
  returnType: 'boolean',
  examples: ['includes("hello world", "world") → true', 'includes("hello", "xyz") → false'],
};

export const indexOfSignature: FunctionSignature = {
  name: 'indexOf',
  category: 'string',
  description: 'Find index of substring',
  parameters: [
    { name: 'substring', type: 'string', required: true, description: 'Substring to find' },
  ],
  returnType: 'number',
  examples: ['indexOf("hello world", "world") → 6', 'indexOf("hello", "xyz") → -1'],
};

export const padStartSignature: FunctionSignature = {
  name: 'padStart',
  category: 'string',
  description: 'Pad string from start to target length',
  parameters: [
    { name: 'length', type: 'number', required: true, description: 'Target length' },
    {
      name: 'fillStr',
      type: 'string',
      required: false,
      description: 'Fill string (default: " ")',
    },
  ],
  returnType: 'string',
  examples: ['padStart("5", 3, "0") → "005"', 'padStart("hello", 7) → "  hello"'],
};

export const padEndSignature: FunctionSignature = {
  name: 'padEnd',
  category: 'string',
  description: 'Pad string from end to target length',
  parameters: [
    { name: 'length', type: 'number', required: true, description: 'Target length' },
    {
      name: 'fillStr',
      type: 'string',
      required: false,
      description: 'Fill string (default: " ")',
    },
  ],
  returnType: 'string',
  examples: ['padEnd("5", 3, "0") → "500"', 'padEnd("hello", 7) → "hello  "'],
};

export const repeatSignature: FunctionSignature = {
  name: 'repeat',
  category: 'string',
  description: 'Repeat string n times',
  parameters: [
    { name: 'count', type: 'number', required: true, description: 'Number of repetitions' },
  ],
  returnType: 'string',
  examples: ['repeat("ab", 3) → "ababab"', 'repeat("x", 5) → "xxxxx"'],
};

export const reverseSignature: FunctionSignature = {
  name: 'reverse',
  category: 'string',
  description: 'Reverse string',
  parameters: [],
  returnType: 'string',
  examples: ['reverse("hello") → "olleh"'],
};

export const escapeSignature: FunctionSignature = {
  name: 'escape',
  category: 'string',
  description: 'HTML escape string',
  parameters: [],
  returnType: 'string',
  examples: ['escape("<script>") → "&lt;script&gt;"'],
};

// String function handlers
export const upper: FilterFunction = (value: unknown): string => {
  return String(value).toUpperCase();
};

export const lower: FilterFunction = (value: unknown): string => {
  return String(value).toLowerCase();
};

export const capitalize: FilterFunction = (value: unknown): string => {
  const str = String(value);
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
};

export const trim: FilterFunction = (value: unknown): string => {
  return String(value).trim();
};

export const ltrim: FilterFunction = (value: unknown): string => {
  return String(value).replace(/^\s+/, '');
};

export const rtrim: FilterFunction = (value: unknown): string => {
  return String(value).replace(/\s+$/, '');
};

export const replace: FilterFunction = (
  value: unknown,
  search: unknown,
  replacement: unknown
): string => {
  const str = String(value);
  const searchStr = String(search);
  const replaceStr = String(replacement);
  return str.replace(new RegExp(searchStr, 'g'), replaceStr);
};

export const slice: FilterFunction = (value: unknown, start: unknown, end?: unknown): string => {
  const str = String(value);
  const startIdx = Number(start);
  const endIdx = end !== undefined ? Number(end) : undefined;
  return str.slice(startIdx, endIdx);
};

export const split: FilterFunction = (value: unknown, delimiter: unknown): string[] => {
  return String(value).split(String(delimiter));
};

export const join: FilterFunction = (value: unknown, separator: unknown): string => {
  if (!Array.isArray(value)) {
    throw new Error('join expects an array');
  }
  return (value as unknown[]).join(String(separator));
};

export const startsWith: FilterFunction = (value: unknown, prefix: unknown): boolean => {
  return String(value).startsWith(String(prefix));
};

export const endsWith: FilterFunction = (value: unknown, suffix: unknown): boolean => {
  return String(value).endsWith(String(suffix));
};

export const includes: FilterFunction = (value: unknown, substring: unknown): boolean => {
  return String(value).includes(String(substring));
};

export const indexOf: FilterFunction = (value: unknown, substring: unknown): number => {
  return String(value).indexOf(String(substring));
};

export const padStart: FilterFunction = (
  value: unknown,
  length: unknown,
  fillStr?: unknown
): string => {
  return String(value).padStart(Number(length), fillStr ? String(fillStr) : ' ');
};

export const padEnd: FilterFunction = (
  value: unknown,
  length: unknown,
  fillStr?: unknown
): string => {
  return String(value).padEnd(Number(length), fillStr ? String(fillStr) : ' ');
};

export const repeat: FilterFunction = (value: unknown, count: unknown): string => {
  return String(value).repeat(Number(count));
};

export const reverse: FilterFunction = (value: unknown): string => {
  return String(value).split('').reverse().join('');
};

export const escape: FilterFunction = (value: unknown): string => {
  const str = String(value);
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => escapeMap[char] ?? char);
};

/**
 * Export all string function registrations
 */
export const stringFunctions = [
  { signature: upperSignature, handler: upper },
  { signature: lowerSignature, handler: lower },
  { signature: capitalizeSignature, handler: capitalize },
  { signature: trimSignature, handler: trim },
  { signature: ltrimSignature, handler: ltrim },
  { signature: rtrimSignature, handler: rtrim },
  { signature: replaceSignature, handler: replace },
  { signature: sliceSignature, handler: slice },
  { signature: splitSignature, handler: split },
  { signature: joinSignature, handler: join },
  { signature: startsWithSignature, handler: startsWith },
  { signature: endsWithSignature, handler: endsWith },
  { signature: includesSignature, handler: includes },
  { signature: indexOfSignature, handler: indexOf },
  { signature: padStartSignature, handler: padStart },
  { signature: padEndSignature, handler: padEnd },
  { signature: repeatSignature, handler: repeat },
  { signature: reverseSignature, handler: reverse },
  { signature: escapeSignature, handler: escape },
];
