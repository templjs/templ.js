import { describe, expect, it, vi } from 'vitest';

vi.mock('@templjs/core', () => ({
  validateTemplate: vi.fn(),
}));

import { validateTemplate as coreValidateTemplate } from '@templjs/core';
import { validateCommand } from './validate';

describe('validateCommand', () => {
  it.each([
    { valid: true, expected: true },
    { valid: false, expected: false },
  ])('returns $expected when core validation is $valid', async ({ valid, expected }) => {
    vi.mocked(coreValidateTemplate).mockReturnValue({ valid, errors: valid ? [] : ['bad'] });
    await expect(validateCommand('template.templ')).resolves.toBe(expected);
  });

  it('wraps thrown errors with validation context', async () => {
    vi.mocked(coreValidateTemplate).mockImplementation(() => {
      throw new Error('validation crashed');
    });

    await expect(validateCommand('template.templ')).rejects.toThrow(
      'Validation failed: validation crashed'
    );
  });
});
