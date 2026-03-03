import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
}));

import { writeFileSync } from 'fs';
import { initCommand } from './init';

describe('initCommand', () => {
  it('returns starter template for a supported format', async () => {
    const output = await initCommand({ format: 'markdown' });

    expect(output).toContain('# Report');
    expect(output).toContain('{% for user in users %}');
  });

  it('writes starter template to output file when path is provided', async () => {
    await initCommand({ format: 'html', output: 'starter.templ.html' });

    expect(writeFileSync).toHaveBeenCalledWith(
      'starter.templ.html',
      expect.stringContaining('<ul>'),
      'utf-8'
    );
  });

  it('throws on unsupported format', async () => {
    await expect(initCommand({ format: 'toml' })).rejects.toThrow('Unsupported format: toml');
  });
});
