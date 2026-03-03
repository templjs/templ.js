import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(),
}));

import { readFileSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import { renderCommand } from './render';

describe('renderCommand', () => {
  it('renders template output from file and JSON payload', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.templ', '{"name":"World"}');

    expect(output).toBe('Hello World');
    expect(readFileSync).toHaveBeenCalledWith('template.templ', 'utf-8');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'World' });
  });

  it('wraps failures with render context', async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('missing file');
    });

    await expect(renderCommand('missing.templ', '{"x":1}')).rejects.toThrow(
      'Render failed: missing file'
    );
  });
});
