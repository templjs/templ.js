import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine';
import { extendedFunctions, wiBaselineFunctions } from './catalog';

describe('QueryEngine catalog parity', () => {
  it('contains all WI baseline functions', () => {
    const engine = new QueryEngine();
    const registered = new Set(engine.listFunctions());

    for (const [category, functions] of Object.entries(wiBaselineFunctions)) {
      for (const fn of functions) {
        expect(registered.has(fn), `Missing ${category} baseline function "${fn}"`).toBe(true);
      }
    }
  });

  it('contains all documented extended functions', () => {
    const engine = new QueryEngine();
    const registered = new Set(engine.listFunctions());

    for (const fn of extendedFunctions) {
      expect(registered.has(fn), `Missing extended function "${fn}"`).toBe(true);
    }
  });
});
