import { describe, expect, it } from 'vitest';
import type { PathSegment } from '../parser/types.js';
import { pathSegmentToString } from './template-scopes.js';

describe('pathSegmentToString', () => {
  it('returns literal index values without normalization', () => {
    const segment: PathSegment = {
      type: 'index',
      value: {
        type: 'literal',
        value: 42,
      } as PathSegment['value'],
    };

    expect(pathSegmentToString(segment)).toBe('[42]');
  });

  it('normalizes non-literal index expressions to [0]', () => {
    const segment: PathSegment = {
      type: 'index',
      value: {
        type: 'variable',
        name: 'dynamicIndex',
      } as PathSegment['value'],
    };

    expect(pathSegmentToString(segment)).toBe('[0]');
  });
});
