import { describe, expect, it } from 'vitest';
import { QueryEngine } from '../../src/query-engine/query-engine.js';

describe('QueryEngine metadata', () => {
  it('stores overload signatures per function name', () => {
    const engine = new QueryEngine();
    const metadata = engine.getMetadata();
    const reverseSignatures = metadata.functions.get('reverse') ?? [];

    expect(reverseSignatures.length).toBeGreaterThanOrEqual(2);
    expect(reverseSignatures.some((signature) => signature.category === 'string')).toBe(true);
    expect(reverseSignatures.some((signature) => signature.category === 'array')).toBe(true);
  });

  it('registers and retrieves variable metadata', () => {
    const engine = new QueryEngine();
    engine.registerVariableType('user', {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    });
    engine.registerVariables({
      items: { type: 'array', items: { type: 'number' } },
      active: { type: 'boolean' },
    });

    expect(engine.getVariableType('user')?.properties?.profile.properties?.name.type).toBe(
      'string'
    );
    expect(engine.getVariableType('items')?.type).toBe('array');
    expect(engine.getVariableType('active')?.type).toBe('boolean');
  });

  it('clears variable metadata', () => {
    const engine = new QueryEngine();
    engine.registerVariableType('a', { type: 'string' });
    expect(engine.getMetadata().variables.size).toBe(1);

    engine.clearVariableMetadata();
    expect(engine.getMetadata().variables.size).toBe(0);
  });
});
