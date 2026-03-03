import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine';
import {
  avg as avgNumberHandler,
  log as logNumberHandler,
  max as maxNumberHandler,
  min as minNumberHandler,
  parseInt as parseIntNumberHandler,
  product as productNumberHandler,
  round as roundNumberHandler,
  toFixed as toFixedNumberHandler,
} from '../../src/query-engine/functions/number-functions';

const engine = new QueryEngine();

describe('QueryEngine number functions', () => {
  it('supports WI baseline arithmetic and trig functions', () => {
    expect(engine.applyFilter(3.14159, 'round', [2])).toBe(3.14);
    expect(engine.applyFilter(3.7, 'floor', [])).toBe(3);
    expect(engine.applyFilter(3.2, 'ceil', [])).toBe(4);
    expect(engine.applyFilter(-3, 'abs', [])).toBe(3);
    expect(engine.applyFilter(2, 'pow', [3])).toBe(8);
    expect(engine.applyFilter(100, 'log', [10])).toBeCloseTo(2, 10);
    expect(engine.applyFilter(1, 'exp', [])).toBeCloseTo(Math.E, 10);
    expect(engine.applyFilter(Math.PI / 2, 'sin', [])).toBeCloseTo(1, 10);
    expect(engine.applyFilter(0, 'cos', [])).toBeCloseTo(1, 10);
    expect(engine.applyFilter(0, 'tan', [])).toBeCloseTo(0, 10);
  });

  it('supports WI baseline aggregate functions', () => {
    expect(engine.applyFilter([1, 2, 3], 'sum', [])).toBe(6);
    expect(engine.applyFilter([1, 2, 3], 'avg', [])).toBe(2);
    expect(engine.applyFilter([2, 3, 4], 'product', [])).toBe(24);
    expect(engine.applyFilter([5, 3, 9], 'min', [])).toBe(3);
    expect(engine.applyFilter([5, 3, 9], 'max', [])).toBe(9);
    expect(engine.applyFilter(5, 'min', [2, 8])).toBe(2);
    expect(engine.applyFilter(5, 'max', [2, 8])).toBe(8);
    expect(engine.applyFilter(200, 'clamp', [0, 100])).toBe(100);
    expect(engine.applyFilter(9, 'sqrt', [])).toBe(3);
  });

  it('keeps extended numeric helpers', () => {
    expect(engine.applyFilter(-42, 'sign', [])).toBe(-1);
    expect(engine.applyFilter(3.14159, 'toFixed', [2])).toBe('3.14');
    expect(engine.applyFilter('101', 'parseInt', [2])).toBe(5);
    expect(engine.applyFilter('3.14', 'parseFloat', [])).toBe(3.14);
    expect(engine.applyFilter('abc', 'isNaN', [])).toBe(true);
    expect(engine.applyFilter('42', 'isFinite', [])).toBe(true);
  });

  it('throws for invalid numeric aggregate input', () => {
    expect(() => engine.applyFilter(123, 'sum', [])).toThrow('sum expects an array');
    expect(() => engine.applyFilter(123, 'avg', [])).toThrow('avg expects an array');
    expect(() => engine.applyFilter(123, 'product', [])).toThrow('product expects an array');
  });

  it('covers optional-argument and scalar branches in number handlers', () => {
    expect(roundNumberHandler(3.6)).toBe(4);
    expect(minNumberHandler(10, 3, 5)).toBe(3);
    expect(maxNumberHandler(10, 3, 5)).toBe(10);
    expect(logNumberHandler(Math.E)).toBeCloseTo(1, 10);
    expect(() => logNumberHandler(8, 1)).toThrow(
      'log base must be greater than 0 and not equal to 1'
    );
    expect(avgNumberHandler([])).toBe(0);
    expect(productNumberHandler([])).toBe(0);
    expect(toFixedNumberHandler(3.5)).toBe('4');
    expect(parseIntNumberHandler('42')).toBe(42);
  });
});
