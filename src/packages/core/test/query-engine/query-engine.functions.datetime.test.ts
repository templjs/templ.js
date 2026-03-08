import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';
import {
  addDays as addDaysHandler,
  addHours as addHoursHandler,
  addMinutes as addMinutesHandler,
  diff as diffDatetimeHandler,
  format as formatDatetimeHandler,
  fromISO as fromISOHandler,
  getDate as getDateHandler,
  getDay as getDayHandler,
  getDayOfWeek as getDayOfWeekHandler,
  getHour as getHourHandler,
  getMonth as getMonthHandler,
  getYear as getYearHandler,
  parse as parseDatetimeHandler,
  timestamp as timestampDatetimeHandler,
  timezone as timezoneDatetimeHandler,
  toISO as toISOHandler,
} from '../../src/query-engine/functions/datetime-functions.js';

const engine = new QueryEngine();
const baseTs = Date.UTC(2024, 1, 18, 12, 34, 56);

describe('QueryEngine datetime functions', () => {
  it('supports WI baseline datetime functions', () => {
    expect(typeof engine.applyFilter(null, 'now', [])).toBe('number');
    expect(engine.applyFilter(baseTs, 'format', ['YYYY-MM-DD'])).toBe('2024-02-18');
    expect(engine.applyFilter('2024-02-18', 'parse', ['YYYY-MM-DD'])).toBeTypeOf('number');
    expect(engine.applyFilter(baseTs, 'addDays', [2])).toBe(baseTs + 2 * 24 * 60 * 60 * 1000);
    expect(engine.applyFilter(baseTs, 'addHours', [3])).toBe(baseTs + 3 * 60 * 60 * 1000);
    expect(engine.applyFilter(baseTs, 'addMinutes', [15])).toBe(baseTs + 15 * 60 * 1000);
    expect(engine.applyFilter(baseTs, 'getYear', [])).toBe(2024);
    expect(engine.applyFilter(baseTs, 'getMonth', [])).toBe(1);
    expect(engine.applyFilter(baseTs, 'getDay', [])).toBe(18);
    expect(engine.applyFilter(baseTs, 'getHour', [])).toBe(new Date(baseTs).getHours());
    expect(engine.applyFilter(baseTs, 'timestamp', [])).toBe(baseTs);
    expect(engine.applyFilter(baseTs, 'timezone', ['UTC'])).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    );
  });

  it('keeps extended datetime helpers', () => {
    expect(engine.applyFilter(baseTs, 'getDate', [])).toBe(18);
    expect(engine.applyFilter(baseTs, 'getDayOfWeek', [])).toBe(0);
    expect(engine.applyFilter(baseTs, 'toISO', [])).toBe('2024-02-18T12:34:56.000Z');
    expect(engine.applyFilter('2024-02-18T12:34:56.000Z', 'fromISO', [])).toBe(baseTs);
    expect(engine.applyFilter(baseTs, 'diff', [baseTs + 1000])).toBe(1000);
  });

  it('covers non-number value branches for datetime handlers', () => {
    const date = new Date(baseTs);
    expect(formatDatetimeHandler(date, 'YYYY-MM-DD')).toBe('2024-02-18');
    expect(addDaysHandler(date, 1)).toBe(baseTs + 24 * 60 * 60 * 1000);
    expect(addHoursHandler(date, 1)).toBe(baseTs + 60 * 60 * 1000);
    expect(addMinutesHandler(date, 1)).toBe(baseTs + 60 * 1000);
    expect(getYearHandler(date)).toBe(2024);
    expect(getMonthHandler(date)).toBe(1);
    expect(getDayHandler(date)).toBe(18);
    expect(getHourHandler(date)).toBe(new Date(baseTs).getHours());
    expect(getDateHandler(date)).toBe(18);
    expect(getDayOfWeekHandler(date)).toBe(0);
    expect(toISOHandler(date)).toBe('2024-02-18T12:34:56.000Z');
    expect(timezoneDatetimeHandler(date, 'UTC')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(diffDatetimeHandler(date, new Date(baseTs + 2000))).toBe(2000);
  });

  it('covers parse/timestamp fallback branches and string diff branch', () => {
    expect(parseDatetimeHandler('2024/02/18', 'MM/DD/YYYY')).toBeTypeOf('number');
    expect(timestampDatetimeHandler(new Date(baseTs))).toBe(baseTs);
    expect(timestampDatetimeHandler('2024-02-18T12:34:56.000Z')).toBe(baseTs);
    expect(diffDatetimeHandler(baseTs, '2024-02-18T12:34:57.000Z')).toBe(1000);
    expect(fromISOHandler('2024-02-18T12:34:56.000Z')).toBe(baseTs);
  });

  it('covers nullish getTime fallback branches for non-date values', () => {
    const fallbackValue = 'not-a-date-object';

    expect(formatDatetimeHandler(fallbackValue, 'YYYY-MM-DD')).toBe(
      formatDatetimeHandler(0, 'YYYY-MM-DD')
    );
    expect(addDaysHandler(fallbackValue, 1)).toBe(addDaysHandler(0, 1));
    expect(addHoursHandler(fallbackValue, 1)).toBe(addHoursHandler(0, 1));
    expect(addMinutesHandler(fallbackValue, 1)).toBe(addMinutesHandler(0, 1));
    expect(getYearHandler(fallbackValue)).toBe(getYearHandler(0));
    expect(getMonthHandler(fallbackValue)).toBe(getMonthHandler(0));
    expect(getDayHandler(fallbackValue)).toBe(getDayHandler(0));
    expect(getHourHandler(fallbackValue)).toBe(getHourHandler(0));
    expect(getDateHandler(fallbackValue)).toBe(getDateHandler(0));
    expect(getDayOfWeekHandler(fallbackValue)).toBe(getDayOfWeekHandler(0));
    expect(toISOHandler(fallbackValue)).toBe(toISOHandler(0));
    expect(timezoneDatetimeHandler(fallbackValue, 'UTC')).toBe(timezoneDatetimeHandler(0, 'UTC'));
    expect(diffDatetimeHandler(fallbackValue, 1000)).toBe(1000);
  });
});
