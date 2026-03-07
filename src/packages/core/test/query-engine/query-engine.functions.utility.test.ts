import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';

const engine = new QueryEngine();

describe('QueryEngine utility functions', () => {
  it('supports default fallback behavior', () => {
    expect(engine.applyFilter(undefined, 'default', ['fallback'])).toBe('fallback');
    expect(engine.applyFilter(null, 'default', ['fallback'])).toBe('fallback');
    expect(engine.applyFilter('', 'default', ['fallback'])).toBe('fallback');
    expect(engine.applyFilter(false, 'default', ['fallback'])).toBe(false);
    expect(engine.applyFilter('value', 'default', ['fallback'])).toBe('value');
  });
});
