import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('@templjs/core', () => ({
  validateTemplate: vi.fn(),
}));

import { readFileSync } from 'fs';
import { validateTemplate as coreValidateTemplate } from '@templjs/core';
import { validateCommand } from '../../src/commands/validate';

describe('validateCommand', () => {
  it.each([
    { valid: true, expected: true },
    { valid: false, expected: false },
  ])('returns $expected when core validation is $valid', async ({ valid, expected }) => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid, errors: valid ? [] : ['bad'] });
    await expect(validateCommand('template.templ')).resolves.toBe(expected);

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
});
