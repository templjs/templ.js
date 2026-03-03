import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { QueryEngine, filter, query } from '../../src/query-engine/query-engine';
import type { FunctionSignature } from '../../src/query-engine/types';

function makeSignature(
  name: string,
  category: FunctionSignature['category'],
  parameters: FunctionSignature['parameters']
): FunctionSignature {
  return {
    name,
    category,
    description: `test signature ${name}`,
    parameters,
    returnType: 'any',
    examples: [],
  };
}

describe('QueryEngine', () => {
  it('registers built-in functions at construction time', () => {
    const engine = new QueryEngine();

    const functions = engine.listFunctions();
    expect(functions.length).toBeGreaterThanOrEqual(40);
    expect(functions).toContain('upper');
    expect(functions).toContain('round');
    expect(functions).toContain('now');
    expect(functions).toContain('keys');

    expect(engine.getFunctionsByCategory('string')).toContain('upper');
    expect(engine.getFunctionsByCategory('number')).toContain('round');
    expect(engine.getFunctionsByCategory('datetime')).toContain('now');
    expect(engine.getFunctionsByCategory('array')).toContain('length');
    expect(engine.getFunctionsByCategory('object')).toContain('keys');
  });

  it('resolves dot-notation and numeric array indexes', () => {
    const engine = new QueryEngine();
    const data = { user: { profile: { name: 'Alice' } }, values: ['x', 'y', 'z'] };

    expect(engine.query(data, 'user.profile.name')).toBe('Alice');
    expect(engine.query(data, 'values[1]')).toBe('y');
  });

  it('resolves variable indexes from root data', () => {
    const engine = new QueryEngine();
    const data = { items: ['zero', 'one', 'two'], idx: 2 };

    expect(engine.query(data, 'items[idx]')).toBe('two');
  });

  it('supports chained bracket access with variable indexes', () => {
    const engine = new QueryEngine();
    const data = {
      matrix: [
        ['a0', 'a1'],
        ['b0', 'b1'],
      ],
      row: 1,
      col: 0,
    };

    expect(engine.query(data, 'matrix[row][col]')).toBe('b0');
  });

  it('supports quoted object keys in brackets', () => {
    const engine = new QueryEngine();
    const data = { user: { 'display-name': 'templjs' } };

    expect(engine.query(data, 'user["display-name"]')).toBe('templjs');
  });

  it('applies default value only when resolution is undefined', () => {
    const engine = new QueryEngine();
    const data = { user: { name: 'Alice' } };

    expect(engine.query(data, 'user.name', { defaultValue: 'fallback' })).toBe('Alice');
    expect(engine.query(data, 'user.email', { defaultValue: 'fallback' })).toBe('fallback');
  });

  it('dispatches overloaded built-ins by runtime value category', () => {
    const engine = new QueryEngine();

    expect(engine.applyFilter('abc', 'reverse', [])).toBe('cba');
    expect(engine.applyFilter([1, 2, 3], 'reverse', [])).toEqual([3, 2, 1]);
  });

  it('validates required argument counts', () => {
    const engine = new QueryEngine();

    expect(() => engine.applyFilter('hello world', 'replace', ['world'])).toThrow(
      'expects at least'
    );
    expect(() => engine.applyFilter('hello', 'upper', ['unexpected'])).toThrow('expects at most');
  });

  it('validates argument types', () => {
    const engine = new QueryEngine();

    expect(() => engine.applyFilter(3.14159, 'round', ['2'])).toThrow('expected type "number"');
    expect(engine.applyFilter(3.14159, 'round', [2])).toBe(3.14);
  });

  it('handles strict vs non-strict query failures', () => {
    const engine = new QueryEngine();
    const throwingData = {
      get boom(): string {
        throw new Error('boom');
      },
    };

    expect(() =>
      engine.query({ user: null }, 'user.name', { strict: true, defaultValue: 'fallback' })
    ).toThrow('Cannot access property');
    expect(engine.query(throwingData, 'boom', { defaultValue: 'fallback' })).toBe('fallback');
    expect(() => engine.query(throwingData, 'boom', { strict: true })).toThrow('boom');
  });

  it('handles depth, unresolved parent access, and bracket parsing edge cases', () => {
    const engine = new QueryEngine();

    expect(() => engine.query({ a: { b: 1 } }, 'a.b', { strict: true, maxDepth: 1 })).toThrow(
      'Max nesting depth (1) exceeded'
    );
    expect(engine.query({}, 'a.b')).toBeUndefined();
    expect(engine.query({ items: { key: 'name', name: 'value' } }, 'items[key')).toBe('value');
    expect(engine.query({ obj: { idx: 'name', name: 'templjs' } }, 'obj[idx]')).toBe('templjs');
    expect(engine.query({ obj: { name: 'templjs' } }, 'obj[missing]')).toBeUndefined();
  });

  it('returns undefined metadata lookups for unknown functions', () => {
    const engine = new QueryEngine();

    expect(engine.getFunction('missing')).toBeUndefined();
    expect(engine.getFunctionSignatures('missing')).toEqual([]);
  });

  it('selects overloads by argument match when category does not match', () => {
    const engine = new QueryEngine();
    const name = '__arg_select';

    engine.registerFunction(
      makeSignature(name, 'string', [
        { name: 'v', type: 'number', required: true, description: 'number arg' },
      ]),
      (_value, arg) => `num:${arg}`
    );
    engine.registerFunction(
      makeSignature(name, 'number', [
        { name: 'v', type: 'string', required: true, description: 'string arg' },
      ]),
      (_value, arg) => `str:${arg}`
    );

    expect(engine.applyFilter(true, name, [42])).toBe('num:42');
    expect(engine.applyFilter(false, name, ['ok'])).toBe('str:ok');
  });

  it('falls back to first category match when args do not match any overload', () => {
    const engine = new QueryEngine();
    const name = '__category_fallback';

    engine.registerFunction(
      makeSignature(name, 'string', [
        { name: 'flag', type: 'boolean', required: true, description: 'flag' },
      ]),
      () => 'first'
    );
    engine.registerFunction(
      makeSignature(name, 'string', [
        { name: 'n', type: 'null', required: true, description: 'n' },
      ]),
      () => 'second'
    );

    expect(() => engine.applyFilter('value', name, [123])).toThrow('expected type "boolean"');
  });

  it('falls back to first registered overload when neither category nor args match', () => {
    const engine = new QueryEngine();
    const name = '__entry_fallback';

    engine.registerFunction(
      makeSignature(name, 'string', [
        { name: 'flag', type: 'boolean', required: true, description: 'flag' },
      ]),
      () => 'first'
    );
    engine.registerFunction(
      makeSignature(name, 'number', [
        { name: 'n', type: 'null', required: true, description: 'n' },
      ]),
      () => 'second'
    );

    expect(() => engine.applyFilter({ value: true }, name, [123])).toThrow(
      'expected type "boolean"'
    );
  });

  it('handles union-any and runtime type reporting for null values', () => {
    const engine = new QueryEngine();

    engine.registerFunction(
      makeSignature('__union_any', 'utility', [
        { name: 'arg', type: 'string|any', required: true, description: 'arg' },
      ]),
      (_value, arg) => arg
    );
    engine.registerFunction(
      makeSignature('__bool', 'utility', [
        { name: 'flag', type: 'boolean', required: true, description: 'flag' },
      ]),
      (_value, arg) => arg
    );
    engine.registerFunction(
      makeSignature('__null', 'utility', [
        { name: 'n', type: 'null', required: true, description: 'n' },
      ]),
      () => 'null-ok'
    );
    engine.registerFunction(
      makeSignature('__unknown_type', 'utility', [
        { name: 'x', type: 'mystery', required: true, description: 'x' },
      ]),
      () => 'never'
    );

    expect(engine.applyFilter('value', '__union_any', [false])).toBe(false);
    expect(engine.applyFilter('value', '__bool', [true])).toBe(true);
    expect(engine.applyFilter('value', '__null', [null])).toBe('null-ok');
    expect(() => engine.applyFilter('value', '__unknown_type', [null])).toThrow('received "null"');
  });

  it('covers category matching for number, datetime, utility, and unknown categories', () => {
    const engine = new QueryEngine();
    const name = '__category_match_coverage';

    engine.registerFunction(makeSignature(name, 'number', []), () => 'number');
    engine.registerFunction(makeSignature(name, 'datetime', []), () => 'datetime');
    engine.registerFunction(makeSignature(name, 'utility', []), () => 'utility');
    engine.registerFunction(
      {
        ...makeSignature(name, 'utility', []),
        category: 'invalid' as unknown as FunctionSignature['category'],
      },
      () => 'invalid'
    );

    expect(engine.applyFilter(10, name, [])).toBe('number');
    expect(engine.applyFilter(new Date(), name, [])).toBe('datetime');
  });

  it('handles sparse parameter signatures during validation', () => {
    const engine = new QueryEngine();
    const sparseParameters = new Array(1) as FunctionSignature['parameters'];

    engine.registerFunction(
      makeSignature('__sparse_params', 'utility', sparseParameters),
      () => 'sparse-ok'
    );

    expect(engine.applyFilter('value', '__sparse_params', ['arg'])).toBe('sparse-ok');
  });

  it('formats non-Error thrown values in filter execution failures', () => {
    const engine = new QueryEngine();
    engine.registerFunction(makeSignature('__throw_string', 'utility', []), () => {
      throw 'plain-string-error';
    });

    expect(() => engine.applyFilter('value', '__throw_string', [])).toThrow(
      'Error applying filter "__throw_string": plain-string-error'
    );
  });

  it('covers overload arg-count mismatch and array runtime type messaging', () => {
    const engine = new QueryEngine();
    const name = '__arg_count_and_array_type';

    engine.registerFunction(
      makeSignature(name, 'string', [
        { name: 'value', type: 'string', required: true, description: '' },
      ]),
      () => 'string'
    );
    engine.registerFunction(
      makeSignature(name, 'number', [
        { name: 'value', type: 'number', required: true, description: '' },
      ]),
      () => 'number'
    );

    expect(() => engine.applyFilter({}, name, ['a', 'b'])).toThrow('expects at most');
    expect(() => engine.applyFilter({}, name, [[]])).toThrow('received "array"');
  });

  it('throws for unknown filters', () => {
    const engine = new QueryEngine();
    expect(() => engine.applyFilter('value', 'missingFilter', [])).toThrow('Unknown filter');
  });

  it('measures filter-chain performance under 1ms average', () => {
    const engine = new QueryEngine();
    const iterations = 5000;
    const input = '  alpha,beta,gamma  ';
    let finalValue: unknown = undefined;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      let value: unknown = input;
      value = engine.applyFilter(value, 'trim', []);
      value = engine.applyFilter(value, 'upper', []);
      value = engine.applyFilter(value, 'split', [',']);
      value = engine.applyFilter(value, 'join', ['|']);
      finalValue = value;
    }
    const elapsedMs = performance.now() - start;
    const averageMs = elapsedMs / iterations;

    expect(finalValue).toBe('ALPHA|BETA|GAMMA');
    expect(averageMs).toBeLessThan(2);
  });
});

describe('query-engine convenience exports', () => {
  it('supports default query and filter helpers', () => {
    const data = { values: ['x', 'y'], index: 1 };

    expect(query(data, 'values[index]')).toBe('y');
    expect(filter('hello', 'upper', [])).toBe('HELLO');
  });
});
