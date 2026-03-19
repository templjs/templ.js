import { describe, expect, it } from 'vitest';
import { where } from '../../src/query-engine/functions/array-functions.js';

describe('array where function', () => {
  it('filters objects by truthy property value', () => {
    const items = [
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: 1 },
      { id: 4, active: 0 },
    ];

    expect(where(items, 'active')).toEqual([
      { id: 1, active: true },
      { id: 3, active: 1 },
    ]);
  });

  it('skips null, undefined, and non-object entries', () => {
    const items: unknown[] = [
      null,
      undefined,
      false,
      0,
      '',
      { id: 1, active: true },
      { id: 2, active: false },
    ];

    expect(where(items, 'active')).toEqual([{ id: 1, active: true }]);
  });

  it('throws for non-array input', () => {
    expect(() => where('not-an-array', 'active')).toThrow('where expects an array');
  });

  it('throws for non-string key', () => {
    const items = [{ active: true }];
    expect(() => where(items, 123)).toThrow('where expects a string key');
  });

  it('handles empty objects and undefined properties as falsy', () => {
    const items = [{}, { active: undefined }, { active: null }, { active: '' }, { active: 'yes' }];

    expect(where(items, 'active')).toEqual([{ active: 'yes' }]);
  });
});
