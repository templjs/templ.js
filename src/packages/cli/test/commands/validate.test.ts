import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('@templjs/core', () => ({
  validateTemplate: vi.fn(),
}));

import { readFileSync } from 'fs';
import { validateTemplate as coreValidateTemplate } from '@templjs/core';
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

  it('warns when schema path is provided before core wiring', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid: true, errors: [] });

    await expect(validateCommand('template.templ', 'schema.json')).resolves.toEqual({
      valid: false,
      errors: [
        'Schema validation flag provided (schema.json) but schema validation is not yet wired in @templjs/core',
      ],
      schemaWarning:
        'Schema validation flag provided (schema.json) but schema validation is not yet wired in @templjs/core',
    });
  });
});
