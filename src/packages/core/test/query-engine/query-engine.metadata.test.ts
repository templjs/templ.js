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

  it('keeps custom function and variable metadata instance-local', () => {
    const first = new QueryEngine();
    const second = new QueryEngine();

    first.registerFunction(
      {
        name: '__local_only',
        description: 'local only',
        category: 'utility',
        parameters: [],
        returnType: 'string',
        examples: [],
      },
      () => 'first'
    );
    first.registerVariableType('local', { type: 'string' });

    expect(first.getFunction('__local_only')?.name).toBe('__local_only');
    expect(first.getVariableType('local')?.type).toBe('string');
    expect(second.getFunction('__local_only')).toBeUndefined();
    expect(second.getVariableType('local')).toBeUndefined();
  });

  it('clones builtin signature metadata for each engine instance', () => {
    const first = new QueryEngine();
    const second = new QueryEngine();

    const firstReplace = first.getFunction('replace');
    const secondReplace = second.getFunction('replace');

    expect(firstReplace).toBeDefined();
    expect(secondReplace).toBeDefined();
    expect(firstReplace).not.toBe(secondReplace);
    expect(firstReplace?.parameters[0]).not.toBe(secondReplace?.parameters[0]);
    expect(firstReplace?.examples).not.toBe(secondReplace?.examples);

    firstReplace?.parameters.push({
      name: 'local-only',
      type: 'string',
      required: false,
      description: 'Locally mutated parameter metadata',
    });
    firstReplace?.examples.push('local mutation');

    expect(second.getFunction('replace')?.parameters).toHaveLength(2);
    expect(second.getFunction('replace')?.examples).toEqual([
      'replace("hello world", "world", "there") → "hello there"',
    ]);
  });

  it('clones custom function signatures during registration', () => {
    const engine = new QueryEngine();
    const signature = {
      name: '__with_parameter_examples',
      description: 'custom signature with nested examples',
      category: 'utility' as const,
      parameters: [
        {
          name: 'fallback',
          type: 'string',
          required: false,
          description: 'Fallback value',
          examples: ['"Guest"'],
        },
      ],
      returnType: 'string',
      examples: ['__with_parameter_examples(null, "Guest") → "Guest"'],
    };

    engine.registerFunction(signature, () => 'value');
    signature.parameters[0]?.examples?.push('"Mutated"');
    signature.examples.push('external mutation');

    const registered = engine.getFunction('__with_parameter_examples');

    expect(registered).not.toBe(signature);
    expect(registered?.parameters[0]).not.toBe(signature.parameters[0]);
    expect(registered?.parameters[0]?.examples).toEqual(['"Guest"']);
    expect(registered?.examples).toEqual(['__with_parameter_examples(null, "Guest") → "Guest"']);
  });
});
