import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';
import {
  concat as concatArrayHandler,
  filter as filterArrayHandler,
  first as firstArrayHandler,
  flatten as flattenArrayHandler,
  find as findArrayHandler,
  includesArray as includesArrayHandler,
  indexOfArray as indexOfArrayHandler,
  joinArray as joinArrayHandler,
  last as lastArrayHandler,
  length as lengthArrayHandler,
  map as mapArrayHandler,
  nth as nthArrayHandler,
  reduce as reduceArrayHandler,
  reverseArray as reverseArrayHandler,
  sliceArray as sliceArrayHandler,
  sort as sortArrayHandler,
  size as sizeArrayHandler,
  unique as uniqueArrayHandler,
} from '../../src/query-engine/functions/array-functions';

const engine = new QueryEngine();

describe('QueryEngine array functions', () => {
  it('supports WI baseline array functions', () => {
    expect(engine.applyFilter([1, 2, 3], 'length', [])).toBe(3);
    expect(engine.applyFilter([1, 2, 3], 'first', [])).toBe(1);
    expect(engine.applyFilter([1, 2, 3], 'last', [])).toBe(3);
    expect(engine.applyFilter([1, 2, 3], 'nth', [1])).toBe(2);
    expect(engine.applyFilter([1, 2, 3], 'reverse', [])).toEqual([3, 2, 1]);
    expect(engine.applyFilter([3, 1, 2], 'sort', [])).toEqual([1, 2, 3]);
    expect(engine.applyFilter([1, 1, 2], 'unique', [])).toEqual([1, 2]);
    expect(engine.applyFilter([[1], [2]], 'flatten', [1])).toEqual([1, 2]);
    expect(engine.applyFilter([1, 2, 3, 4], 'slice', [1, 3])).toEqual([2, 3]);
    expect(engine.applyFilter([1, 2], 'concat', [[3, 4]])).toEqual([1, 2, 3, 4]);
    expect(engine.applyFilter(['a', 'b'], 'join', ['|'])).toBe('a|b');
    expect(engine.applyFilter([1, 2, 3], 'filter', ['> 1'])).toEqual([2, 3]);
    expect(engine.applyFilter([{ n: 1 }, { n: 2 }], 'map', ['n'])).toEqual([1, 2]);
    expect(engine.applyFilter([{ n: 1 }, { n: 2 }], 'find', ['n == 2'])).toEqual({ n: 2 });
    expect(engine.applyFilter([1, 2, 3], 'includes', [2])).toBe(true);
    expect(engine.applyFilter([1, 2, 3], 'indexOf', [3])).toBe(2);
  });

  it('supports function predicates/transforms', () => {
    expect(engine.applyFilter([1, 2, 3], 'filter', [(v: number) => v % 2 === 1])).toEqual([1, 3]);
    expect(engine.applyFilter([1, 2, 3], 'map', [(v: number) => v * 10])).toEqual([10, 20, 30]);
    expect(engine.applyFilter([1, 2, 3], 'find', [(v: number) => v > 1])).toBe(2);
  });

  it('keeps extended array helpers', () => {
    expect(engine.applyFilter({ a: 1, b: 2 }, 'size', [])).toBe(2);
    expect(
      engine.applyFilter([1, 2, 3], 'reduce', [(acc: number, value: number) => acc + value])
    ).toEqual([1, 2, 3]);
  });

  it('covers scalar and field comparison operators in expression predicates', () => {
    expect(engine.applyFilter([1, 2, 3], 'filter', ['>= 2'])).toEqual([2, 3]);
    expect(engine.applyFilter([1, 2, 3], 'filter', ['<= 2'])).toEqual([1, 2]);
    expect(engine.applyFilter([1, 2, 3], 'filter', ['< 3'])).toEqual([1, 2]);
    expect(engine.applyFilter([1, 2, 3], 'filter', ['== 2'])).toEqual([2]);
    expect(engine.applyFilter([1, 2, 3], 'filter', ['!= 2'])).toEqual([1, 3]);

    const users = [
      { score: 3, active: true, name: 'a' },
      { score: 2, active: false, name: 'b' },
      { score: 1, active: false, name: 'c' },
    ];
    expect(engine.applyFilter(users, 'filter', ['score > 1'])).toEqual([users[0], users[1]]);
    expect(engine.applyFilter(users, 'filter', ['score >= 2'])).toEqual([users[0], users[1]]);
    expect(engine.applyFilter(users, 'filter', ['score < 2'])).toEqual([users[2]]);
    expect(engine.applyFilter(users, 'filter', ['score <= 2'])).toEqual([users[1], users[2]]);
    expect(engine.applyFilter(users, 'filter', ['score == 2'])).toEqual([users[1]]);
    expect(engine.applyFilter(users, 'filter', ['score != 2'])).toEqual([users[0], users[2]]);
    expect(engine.applyFilter([1, 2], 'filter', ['x > 1'])).toEqual([]);
    expect(engine.applyFilter([null], 'filter', ['== null'])).toEqual([]);
    expect(engine.applyFilter(['abc'], 'filter', ['== abc'])).toEqual(['abc']);
  });

  it('covers empty predicate, object-truthy field lookup, and scalar string fallback', () => {
    const users = [
      { active: true, name: 'a' },
      { active: false, name: 'b' },
    ];

    expect(engine.applyFilter([1, 2, 3], 'filter', [''])).toEqual([1, 2, 3]);
    expect(engine.applyFilter(users, 'filter', ['active'])).toEqual([users[0]]);
    expect(engine.applyFilter(['a', 'b', 'c'], 'filter', ['b'])).toEqual(['b']);
  });

  it('covers sort equality branch and optional slice end handling', () => {
    expect(engine.applyFilter([3, 1, 2, 2], 'sort', [])).toEqual([1, 2, 2, 3]);
    expect(sortArrayHandler([{ n: 1 }, { n: 3 }, { n: 2 }], 'n')).toEqual([
      { n: 1 },
      { n: 2 },
      { n: 3 },
    ]);
    expect(engine.applyFilter([{ n: 2 }, { n: 1 }, { n: 1 }], 'sort', ['n'])).toEqual([
      { n: 1 },
      { n: 1 },
      { n: 2 },
    ]);
    expect(engine.applyFilter([1, 2, 3, 4], 'slice', [2])).toEqual([3, 4]);
  });

  it('covers size fallback for scalar values', () => {
    expect(engine.applyFilter('value', 'size', [])).toBe(0);
    expect(engine.applyFilter([1, 2, 3], 'size', [])).toBe(3);
    expect(sizeArrayHandler([4, 5])).toBe(2);
  });

  it('covers map-string non-object fallback and flatten default depth', () => {
    expect(engine.applyFilter([1], 'map', ['x'])).toEqual([undefined]);
    expect(engine.applyFilter([[1], [2]], 'flatten', [])).toEqual([1, 2]);
  });

  it('throws array-type errors for array-only handlers', () => {
    const cases: Array<[string, () => unknown]> = [
      ['length', () => lengthArrayHandler('not-array')],
      ['first', () => firstArrayHandler('not-array')],
      ['last', () => lastArrayHandler('not-array')],
      ['nth', () => nthArrayHandler('not-array', 0)],
      ['reverse', () => reverseArrayHandler('not-array')],
      ['sort', () => sortArrayHandler('not-array')],
      ['unique', () => uniqueArrayHandler('not-array')],
      ['filter', () => filterArrayHandler('not-array', (v: unknown) => v)],
      ['map', () => mapArrayHandler('not-array', (v: unknown) => v)],
      ['reduce', () => reduceArrayHandler('not-array')],
      ['join', () => joinArrayHandler('not-array', ',')],
      ['find', () => findArrayHandler('not-array', (v: unknown) => v)],
      ['includes', () => includesArrayHandler('not-array', 'x')],
      ['indexOf', () => indexOfArrayHandler('not-array', 'x')],
      ['slice', () => sliceArrayHandler('not-array', 0, 1)],
      ['concat', () => concatArrayHandler('not-array', [1, 2])],
      ['flatten', () => flattenArrayHandler('not-array', 1)],
    ];

    for (const [name, invoke] of cases) {
      let threw = false;
      try {
        invoke();
      } catch {
        threw = true;
      }
      expect(threw, `${name} should throw for non-array input`).toBe(true);
    }
  });

  it('throws for invalid predicate/transform/condition types in raw handlers', () => {
    expect(() => filterArrayHandler([1, 2, 3], 123 as unknown as string)).toThrow(
      'filter expects predicate to be a function or string'
    );
    expect(() => mapArrayHandler([1, 2, 3], 123 as unknown as string)).toThrow(
      'map expects transform to be a function or string'
    );
    expect(() => findArrayHandler([1, 2, 3], 123 as unknown as string)).toThrow(
      'find expects condition to be a function or string'
    );
  });
});
