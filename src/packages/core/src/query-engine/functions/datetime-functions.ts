/**
 * DateTime Functions
 *
 * Functions for date and time manipulation including formatting,
 * parsing, arithmetic, and timezone operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FunctionSignature, FilterFunction } from '../types';

// DateTime function signatures
export const nowSignature: FunctionSignature = {
  name: 'now',
  category: 'datetime',
  description: 'Get current timestamp',
  parameters: [],
  returnType: 'number',
  examples: ['now() → 1708300800000'],
};

export const formatSignature: FunctionSignature = {
  name: 'format',
  category: 'datetime',
  description: 'Format date to string',
  parameters: [
    {
      name: 'format',
      type: 'string',
      required: true,
      description: 'Format string (YYYY-MM-DD HH:mm:ss)',
    },
  ],
  returnType: 'string',
  examples: [
    'format(new Date(), "YYYY-MM-DD") → "2024-02-18"',
    'format(1708300800000, "YYYY-MM-DD HH:mm:ss") → "2024-02-18 12:00:00"',
  ],
};

export const parseSignature: FunctionSignature = {
  name: 'parse',
  category: 'datetime',
  description: 'Parse date string to timestamp',
  parameters: [
    {
      name: 'format',
      type: 'string',
      required: true,
      description: 'Expected format string',
    },
  ],
  returnType: 'number',
  examples: ['parse("2024-02-18", "YYYY-MM-DD") → 1708300800000'],
};

export const addDaysSignature: FunctionSignature = {
  name: 'addDays',
  category: 'datetime',
  description: 'Add days to date',
  parameters: [
    { name: 'days', type: 'number', required: true, description: 'Number of days to add' },
  ],
  returnType: 'number',
  examples: ['addDays(1708300800000, 5) → 1708819200000'],
};

export const addHoursSignature: FunctionSignature = {
  name: 'addHours',
  category: 'datetime',
  description: 'Add hours to date',
  parameters: [
    { name: 'hours', type: 'number', required: true, description: 'Number of hours to add' },
  ],
  returnType: 'number',
  examples: ['addHours(1708300800000, 3) → 1708311600000'],
};

export const addMinutesSignature: FunctionSignature = {
  name: 'addMinutes',
  category: 'datetime',
  description: 'Add minutes to date',
  parameters: [
    {
      name: 'minutes',
      type: 'number',
      required: true,
      description: 'Number of minutes to add',
    },
  ],
  returnType: 'number',
  examples: ['addMinutes(1708300800000, 30) → 1708302600000'],
};

export const getYearSignature: FunctionSignature = {
  name: 'getYear',
  category: 'datetime',
  description: 'Get year from date',
  parameters: [],
  returnType: 'number',
  examples: ['getYear(1708300800000) → 2024'],
};

export const getMonthSignature: FunctionSignature = {
  name: 'getMonth',
  category: 'datetime',
  description: 'Get month from date (0-11)',
  parameters: [],
  returnType: 'number',
  examples: ['getMonth(1708300800000) → 1'],
};

export const getDaySignature: FunctionSignature = {
  name: 'getDay',
  category: 'datetime',
  description: 'Get day of month from date',
  parameters: [],
  returnType: 'number',
  examples: ['getDay(1708300800000) → 18'],
};

export const getHourSignature: FunctionSignature = {
  name: 'getHour',
  category: 'datetime',
  description: 'Get hour (0-23) from date',
  parameters: [],
  returnType: 'number',
  examples: ['getHour(1708300800000) → 12'],
};

export const timezoneSignature: FunctionSignature = {
  name: 'timezone',
  category: 'datetime',
  description: 'Convert date to timezone-formatted string',
  parameters: [
    { name: 'tz', type: 'string', required: true, description: 'IANA timezone identifier' },
  ],
  returnType: 'string',
  examples: ['timezone(1708300800000, "America/New_York") → "2024-02-18 07:00:00"'],
};

export const timestampSignature: FunctionSignature = {
  name: 'timestamp',
  category: 'datetime',
  description: 'Get Unix timestamp in milliseconds',
  parameters: [],
  returnType: 'number',
  examples: ['timestamp("2024-02-18T12:00:00Z") → 1708257600000'],
};

export const getDateSignature: FunctionSignature = {
  name: 'getDate',
  category: 'datetime',
  description: 'Get day of month from date',
  parameters: [],
  returnType: 'number',
  examples: ['getDate(1708300800000) → 18'],
};

export const getDayOfWeekSignature: FunctionSignature = {
  name: 'getDayOfWeek',
  category: 'datetime',
  description: 'Get day of week (0=Sunday, 6=Saturday)',
  parameters: [],
  returnType: 'number',
  examples: ['getDayOfWeek(1708300800000) → 0'],
};

export const toISOSignature: FunctionSignature = {
  name: 'toISO',
  category: 'datetime',
  description: 'Convert date to ISO string',
  parameters: [],
  returnType: 'string',
  examples: ['toISO(1708300800000) → "2024-02-18T12:00:00.000Z"'],
};

export const fromISOSignature: FunctionSignature = {
  name: 'fromISO',
  category: 'datetime',
  description: 'Parse ISO date string to timestamp',
  parameters: [],
  returnType: 'number',
  examples: ['fromISO("2024-02-18T12:00:00.000Z") → 1708300800000'],
};

export const diffSignature: FunctionSignature = {
  name: 'diff',
  category: 'datetime',
  description: 'Calculate difference between two dates in milliseconds',
  parameters: [
    { name: 'other', type: 'number|string', required: true, description: 'Other date to compare' },
  ],
  returnType: 'number',
  examples: ['diff(1708300800000, 1708387200000) → 86400000'],
};

// DateTime function handlers
export const now: FilterFunction = (): number => {
  return Date.now();
};

export const format: FilterFunction = (value: unknown, fmt: unknown): string => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  const date = new Date(Math.round(Number(timestamp)));
  const formatStr = String(fmt);

  // Simple format implementation
  let result = formatStr;
  const pad = (n: number) => String(n).padStart(2, '0');

  result = result.replace('YYYY', String(date.getFullYear()));
  result = result.replace('MM', pad(date.getMonth() + 1));
  result = result.replace('DD', pad(date.getDate()));
  result = result.replace('HH', pad(date.getHours()));
  result = result.replace('mm', pad(date.getMinutes()));
  result = result.replace('ss', pad(date.getSeconds()));

  return result;
};

export const parse: FilterFunction = (value: unknown, fmt: unknown): number => {
  const dateStr = String(value);
  const formatStr = String(fmt);

  // Simple parser for basic formats
  if (formatStr === 'YYYY-MM-DD') {
    const parts = dateStr.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  }

  // Fallback to Date parsing
  return new Date(dateStr).getTime();
};

export const addDays: FilterFunction = (value: unknown, days: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  const date = new Date(Math.round(Number(timestamp)));
  date.setDate(date.getDate() + Number(days));
  return date.getTime();
};

export const addHours: FilterFunction = (value: unknown, hours: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  const date = new Date(Math.round(Number(timestamp)));
  date.setHours(date.getHours() + Number(hours));
  return date.getTime();
};

export const addMinutes: FilterFunction = (value: unknown, minutes: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  const date = new Date(Math.round(Number(timestamp)));
  date.setMinutes(date.getMinutes() + Number(minutes));
  return date.getTime();
};

export const getYear: FilterFunction = (value: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).getFullYear();
};

export const getMonth: FilterFunction = (value: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).getMonth();
};

export const getDay: FilterFunction = (value: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).getDate();
};

export const getHour: FilterFunction = (value: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).getHours();
};

export const timezone: FilterFunction = (value: unknown, tz: unknown): string => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  const timeZone = String(tz);
  const date = new Date(Math.round(Number(timestamp)));

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')} ${lookup.get('hour')}:${lookup.get('minute')}:${lookup.get('second')}`;
};

export const timestamp: FilterFunction = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }

  return new Date(String(value)).getTime();
};

export const getDate: FilterFunction = (value: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).getDate();
};

export const getDayOfWeek: FilterFunction = (value: unknown): number => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).getDay();
};

export const toISO: FilterFunction = (value: unknown): string => {
  const timestamp = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);
  return new Date(Math.round(Number(timestamp))).toISOString();
};

export const fromISO: FilterFunction = (value: unknown): number => {
  return new Date(String(value)).getTime();
};

export const diff: FilterFunction = (value: unknown, other: unknown): number => {
  const timestamp1 = typeof value === 'number' ? value : ((value as any).getTime?.() ?? 0);

  const timestamp2 =
    typeof other === 'number'
      ? other
      : ((other as any).getTime?.() ?? new Date(String(other)).getTime());
  return Number(timestamp2) - Number(timestamp1);
};

/**
 * Export all datetime function registrations
 */
export const datetimeFunctions = [
  { signature: nowSignature, handler: now },
  { signature: formatSignature, handler: format },
  { signature: parseSignature, handler: parse },
  { signature: addDaysSignature, handler: addDays },
  { signature: addHoursSignature, handler: addHours },
  { signature: addMinutesSignature, handler: addMinutes },
  { signature: getYearSignature, handler: getYear },
  { signature: getMonthSignature, handler: getMonth },
  { signature: getDaySignature, handler: getDay },
  { signature: getHourSignature, handler: getHour },
  { signature: timezoneSignature, handler: timezone },
  { signature: timestampSignature, handler: timestamp },
  { signature: getDateSignature, handler: getDate },
  { signature: getDayOfWeekSignature, handler: getDayOfWeek },
  { signature: toISOSignature, handler: toISO },
  { signature: fromISOSignature, handler: fromISO },
  { signature: diffSignature, handler: diff },
];
