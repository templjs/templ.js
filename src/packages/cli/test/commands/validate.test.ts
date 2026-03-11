import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('@templjs/core', () => ({
  validateTemplate: vi.fn(),
  SchemaValidator: vi.fn(),
}));

vi.mock('../../src/formats/index.js', () => ({
  parseDataAsync: vi.fn(),
}));

import { readFileSync } from 'fs';
import {
  validateTemplate as coreValidateTemplate,
  SchemaValidator as CoreSchemaValidator,
} from '@templjs/core';
import { parseDataAsync } from '../../src/formats/index.js';
import { validateCommand } from '../../src/commands/validate.js';

describe('validateCommand', () => {
  it.each([
    { valid: true, expected: { valid: true, errors: [] } },
    { valid: false, expected: { valid: false, errors: ['bad'] } },
  ])('returns $expected when core validation is $valid', async ({ valid, expected }) => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid, errors: valid ? [] : ['bad'] });
    await expect(validateCommand('template.templ')).resolves.toEqual(expected);

    expect(readFileSync).toHaveBeenCalledWith('template.templ', 'utf-8');
    expect(coreValidateTemplate).toHaveBeenCalledWith('Hello {{ name }}');
  });

  it('wraps thrown errors with validation context', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockImplementation(() => {
      throw new Error('validation crashed');
    });

    await expect(validateCommand('template.templ')).rejects.toThrow(
      'Validation failed: validation crashed'
    );
  });

  it('validates parsed input against provided schema', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(parseDataAsync)
      .mockResolvedValueOnce({
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      })
      .mockResolvedValueOnce({ name: 'Taylor' });

    const validate = vi.fn().mockReturnValue({ valid: true, errors: [] });
    vi.mocked(CoreSchemaValidator).mockImplementation(function mockSchemaValidator() {
      return { validate } as unknown as InstanceType<typeof CoreSchemaValidator>;
    } as unknown as typeof CoreSchemaValidator);

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(parseDataAsync).toHaveBeenNthCalledWith(1, 'Hello {{ name }}', 'schema.json');
    expect(parseDataAsync).toHaveBeenNthCalledWith(2, 'Hello {{ name }}', 'input.json');
  });

  it('returns schema validation errors when input does not match schema', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(parseDataAsync)
      .mockResolvedValueOnce({ type: 'object' })
      .mockResolvedValueOnce({ name: 42 });

    const validate = vi.fn().mockReturnValue({
      valid: false,
      errors: [{ path: 'name', message: 'must be string' }],
    });
    vi.mocked(CoreSchemaValidator).mockImplementation(function mockSchemaValidator() {
      return { validate } as unknown as InstanceType<typeof CoreSchemaValidator>;
    } as unknown as typeof CoreSchemaValidator);

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: false,
      errors: ['Schema validation failed - name: must be string'],
    });
  });

  it('errors when input path is provided without schema path', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid: true, errors: [] });

    await expect(validateCommand('template.templ', undefined, 'input.json')).rejects.toThrow(
      'Validation failed: Schema path is required when validating input data (pass --schema)'
    );
  });
});
